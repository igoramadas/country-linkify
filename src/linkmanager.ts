// COUNTRY LINKIFY: LINK MANAGER

import {Link} from "./types"
import countryManager from "./countrymanager"
import _ from "lodash"
import fs = require("fs")
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
     * Map of link aliases.
     */
    aliases: {[alias: string]: string} = {}

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
                                const basename = path.basename(changedfile, ".json")

                                try {
                                    changedfile = path.join(diretory, changedfile)
                                    logger.info("LinkManager.load.watch", basename, "Reloading")
                                    await this.loadFile(changedfile)
                                } catch (ex) {
                                    logger.warn("LinkManager.load.watch", basename, "Failed to reload")
                                }
                            }
                        })

                        this.watchers.push(watcher)
                    }
                } catch (fileEx) {
                    logger.warn("LinkManager.load", filename, "Failed to load")
                }
            }

            // Load aliases from settings.
            const aEntries = Object.entries(settings.links.aliases)
            if (aEntries.length > 0) {
                aEntries.forEach((e) => (e[1] as any).forEach((a) => (this.aliases[a] = e[0])))
                logger.info("LinkManager.load", `${Object.keys(this.aliases).length} link aliases`)
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
            const source = path.basename(filepath, ".json").toLowerCase()
            const data: any = fs.readFileSync(filepath, {encoding: settings.encoding})
            const entries = Object.entries(JSON.parse(data))

            // Iterate link definitions.
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
                logger.info("LinkManager.loadFile", id, `${urlCount} links for countries ${countryCodes}`)

                const linkData = {
                    id: id,
                    source: source,
                    urls: countryUrls as any
                }

                // Add data to the links store.
                if (source == id) {
                    this.links[id] = linkData
                } else {
                    this.links[`${source}-${id}`] = linkData
                }
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
     * @param sources List of sources to get the link from, optional.
     */
    urlFor = (id: string, country: string, sources?: string[]): string => {
        const sourcesLog = sources?.length > 0 ? sources.join(", ") : "any source"

        try {
            if (!id) {
                throw new Error("Missing link ID")
            }

            const foundLinks: Link[] = []
            const foundUrls: string[] = []

            // Link IDs are always treated lowercased.
            id = id.toLowerCase()

            // Get link directly or from list of aliases, and if not found, check the link
            // for each of the passed sources.
            const directLink = this.links[id] ? this.links[id] : this.aliases[id] ? this.links[this.aliases[id]] : null
            if (directLink) {
                foundLinks.push(directLink)
            } else if (sources?.length > 0) {
                for (let source of sources) {
                    const sourceLink = this.links[`${source}-${id}`]
                    if (sourceLink) {
                        foundLinks.push(sourceLink)
                    }
                }
            }

            // No link found? Stop here.
            if (foundLinks.length == 0) {
                logger.warn("LinkManager.urlFor", id, "Link not found")
                return null
            }

            // Now see if any of the links has a corresponding target for the specified country.
            for (let link of foundLinks) {
                let urls = link.urls[country]

                // Check if specific URLs were set for the country, and if not,
                // get a valid alias for that country.
                if (!urls) {
                    const alias = countryManager.aliases[country]
                    urls = link.urls[alias]

                    // Found link for country alias? If not, try finally a default link.
                    if (urls) {
                        logger.debug("LinkManager.urlFor", id, country, `Has from a country alias: ${alias}`)
                    } else {
                        urls = link.urls.default
                    }
                }

                if (urls?.length > 0) {
                    foundUrls.push.apply(foundUrls, urls)
                }
            }

            // No links found?
            if (foundUrls.length == 0) {
                logger.warn("LinkManager.urlFor", id, "URL not found")
                return null
            }

            // Get a link from the list.
            const result = _.sample(foundUrls)
            logger.info("LinkManager.urlFor", id, country, sourcesLog, result)
            return result
        } catch (ex) {
            logger.error("LinkManager.urlFor", id, country, sourcesLog, ex)
            return null
        }
    }
}

export default LinkManager.Instance
