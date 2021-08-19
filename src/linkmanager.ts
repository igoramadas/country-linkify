// COUNTRY LINKIFY: LINK MANAGER

import {Link} from "./types"
import countryManager from "./countrymanager"
import _ = require("lodash")
import fs = require("fs")
import jaul = require("jaul")
import path = require("path")
import logger = require("anyhow")
const settings = require("setmeup").settings

export class LinkManager {
    private constructor() {}
    private static _instance: LinkManager
    static get Instance() {
        return this._instance || (this._instance = new this())
    }

    /**
     * Watched files.
     */
    private watchers: fs.FSWatcher[] = []

    /**
     * Map of loaded links (by ID).
     */
    links: {[id: string]: Link} = {}

    /**
     * Init by doing the initial link loading.
     */
    init = async (): Promise<void> => {
        try {
            await this.load()
        } catch (ex) {
            logger.error("LinkManager.init", "Failed to init", ex)
            throw ex
        }
    }

    /**
     * Load links from files under the /links folder.
     * @param reset If true, will clear the links cache before loading.
     */
    load = async (reset?: boolean): Promise<void> => {
        try {
            const diretory = path.join(__dirname, "../links")
            const files = fs.readdirSync(diretory)

            // Reset before loading.
            if (reset) {
                const count = Object.keys(this.links).length
                logger.info("LinkManager.load", "Reset", `Cleared ${count} links`)

                // Also clear existing file watchers.
                for (let watcher of this.watchers) {
                    try {
                        watcher.close()
                    } catch (ex) {
                        logger.error("LinkManager.load.reset", ex)
                    }
                }

                // Reset objects.
                this.links = {}
                this.watchers = []
            }

            logger.debug("LinkManager.load", `Will load ${files.length} file(s)`)

            // Iterate files on /links, each file is considered a category.
            for (let filename of files) {
                try {
                    const filepath = path.join(diretory, filename)
                    await this.loadFile(filepath)

                    // Auto reload files when they change?
                    if (settings.links.autoReload) {
                        const watcher = fs.watch(filepath, async (e, changedfile) => {
                            if (changedfile && e == "change") {
                                try {
                                    changedfile = path.join(diretory, changedfile)
                                    logger.info("LinkManager.load.watch", changedfile, "Reloading")
                                    await this.loadFile(changedfile)
                                } catch (ex) {
                                    logger.warn("LinkManager.load.watch", changedfile, "Failed to reload")
                                }
                            }
                        })

                        this.watchers.push(watcher)
                    }
                } catch (fileEx) {
                    logger.warn("LinkManager.load", filename, "Failed to load")
                }
            }
        } catch (ex) {
            logger.error("LinkManager.load", ex)
        }
    }

    /**
     * Load links from the specified file.
     * @param filepath Full path to the file to be loaded.
     */
    loadFile = async (filepath: string): Promise<void> => {
        try {
            const category = path.basename(filepath, ".json").toLowerCase()
            const data: any = fs.readFileSync(filepath, {encoding: settings.encoding})
            const entries = Object.entries(JSON.parse(data))

            // Iterate file link definitions.
            for (let [id, countryUrls] of entries) {
                id = id.toLowerCase()

                // If only a single URL was set for the link, use it as the default,
                // otherwise append the individual per-country links.
                if (_.isString(countryUrls)) {
                    countryUrls = {default: [countryUrls]}
                } else {
                    const targets = Object.entries(countryUrls)

                    // Make sure the URLs are set as an array.
                    for (let [country, urls] of targets) {
                        if (!Array.isArray(urls)) {
                            countryUrls[country] = [urls]
                        }
                    }
                }

                // Log loaded link details.
                const urlReducer = (total, arr) => total + arr.length
                const urlCount = Object.values(countryUrls).reduce(urlReducer, 0)
                const countryCodes = Object.keys(countryUrls).join(", ")
                const translatedPath = filepath.replace(__dirname, "")
                logger.info("LinkManager.loadFile", translatedPath, id, `${urlCount} links for countries ${countryCodes}`)

                const linkData = {
                    id: id,
                    category: category,
                    urls: countryUrls as any
                }

                // Add data to the links store, also with the category prefix.
                this.links[id] = linkData
                if (category != id) this.links[`${category}-${id}`] = linkData
            }
        } catch (ex) {
            logger.error("LinkManager.loadFile", filepath, ex)
            throw ex
        }
    }

    /**
     * Get the correct URL for the specified link and country.
     * @param id Link ID.
     * @param country Country code.
     */
    urlFor = (id: string, country: string): string => {
        try {
            if (!id) {
                throw new Error("Missind link ID")
            }

            // Link IDs are always treated lowercased.
            id = id.toLowerCase()

            const link = this.links[id]

            // Link not found.
            if (!link) {
                logger.warn("LinkManager.urlFor", id, "Link not found")
                return null
            }

            let urls = link.urls[country]

            // Check if specific URLs were set for the country, and if not,
            // get a valid ALIAS for that country.
            if (urls) {
                logger.debug("LinkManager.urlFor", id, country, "Has direct links")
            } else {
                const alias = countryManager.aliases[country]
                urls = link.urls[alias]

                // Found link for country alias? If not, try finally a default link.
                if (urls) {
                    logger.debug("LinkManager.urlFor", id, country, `Has from a country alias: ${alias}`)
                } else {
                    urls = link.urls.default
                }
            }

            // No links found?
            if (!urls) {
                logger.warn("LinkManager.urlFor", id, "Link not found")
                return null
            }

            // Get the first or random link, depending on the randomize setting,
            const index = settings.links.randomize ? Math.floor(Math.random() * urls.length) : 0
            const result = urls[index]

            logger.info("LinkManager.urlFor", id, country, result)
            return urls[index]
        } catch (ex) {
            logger.error("LinkManager.urlFor", id, country, ex)
            return null
        }
    }

    /**
     * Get the URL for the specified search query.
     * @param query Item / text to be searched.
     * @param country Country code.
     */
    urlSearchFor = (query: string, country: string): string => {
        try {
            if (!query) {
                throw new Error("Missing query")
            }

            // Preprocess the query to remove and replace separators.
            query = query.replace(/-/gi, " ").replace(/_/gi, " ").replace(/\./gi, " ")
            query = query.replace(/  /gi, " ")

            // Get search base URL for the specified country, and append the query.
            const searchUrl = settings.search[country] ? settings.search[country] : settings.search[settings.country.default]
            const result = jaul.data.replaceTags(searchUrl, {query: encodeURIComponent(query)})

            logger.info("LinkManager.urlSearchFor", query, country)
            return result
        } catch (ex) {
            logger.error("LinkManager.urlSearchFor", query, country, ex)
            return null
        }
    }
}

export default LinkManager.Instance
