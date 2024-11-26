// COUNTRY LINKIFY: LINK MANAGER

import {Link, TargetURL} from "./types"
import {getSearchQuery} from "./utils"
import countryManager from "./countrymanager"
import _ from "lodash"
import fs from "fs"
import path from "path"
import logger from "anyhow"
let settings

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
     * List of link sources.
     */
    sources: string[] = []

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
        settings = require("setmeup").settings.countryLinkify

        try {
            await this.load()
        } catch (ex) {
            logger.error("LinkManager.init", "Failed to init", ex)
            throw ex
        }
    }

    /**
     * Load links from files under the links folder.
     * @param reset If true, will clear the links cache before loading.
     */
    load = async (reset?: boolean): Promise<void> => {
        try {
            const directory = settings.links.path.substring(0, 1) == "/" ? settings.links.path : path.join(process.cwd(), settings.links.path)
            if (!fs.existsSync(directory)) {
                logger.warn("LinkManager.load", `Directory ${directory} not found, no links were loaded`)
                return
            }

            const files = fs.readdirSync(directory)

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
                    const filepath = path.join(directory, filename)
                    await this.loadFile(filepath)

                    // Auto reload files when they change?
                    if (settings.links.autoReload) {
                        const watcher = fs.watch(filepath, async (e, changedfile) => {
                            if (changedfile && e == "change") {
                                const basename = path.basename(changedfile, ".json")

                                try {
                                    changedfile = path.join(directory, changedfile)
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

            // Load aliases from settings. This will populate the aliases map with their corresponding target ID.
            const aEntries = Object.entries(settings.links.aliases)
            if (aEntries.length > 0) {
                aEntries.forEach((e) =>
                    (e[1] as any).forEach((a) => {
                        this.aliases[a] = e[0]
                        if (settings.links.autoPlural) {
                            this.aliases[`${a}s`] = e[0]
                        }
                    })
                )

                logger.info("LinkManager.load", `${Object.keys(this.aliases).length} link aliases (${settings.links.autoPlural ? "with" : "no"} plurals)`)
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

            if (!this.sources.includes(source)) {
                this.sources.push(source)
            }

            // Iterate link definitions.
            for (let [id, countryUrls] of entries) {
                id = id.toLowerCase()

                // If only a single URL was set for the link, use it as the default,
                // otherwise append the individual per-country links.
                if (_.isString(countryUrls)) {
                    countryUrls = {any: [countryUrls]}
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
                if (id == "default" || id == source) {
                    this.links[source] = linkData
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
     * Get the target URL for the specified link and country.
     * @param id Link ID, or search terms in case of a search.
     * @param country Country code.
     * @param sources List of sources to get the link from, optional, defaults to all.
     * @param search Is it a search and it accepts similar link names?
     */
    urlFor = (id: string, country: string, sources?: string[], search?: boolean): TargetURL => {
        const sourcesLog = sources?.length > 0 ? sources.join(", ") : "any source"
        if (!sources || sources.length == 0) {
            sources = this.sources
        }

        try {
            if (!id) {
                throw new Error("Missing link ID")
            }

            const foundLinks: Link[] = []

            // Link IDs are always treated lowercased.
            id = id.toLowerCase()

            // Get link directly or from list of aliases, and if not found, check the link
            // for each of the passed sources. Will also check for plurals.
            const alias = this.aliases[id]
            const directLink = this.links[id] || this.links[alias]
            if (directLink) {
                foundLinks.push(directLink)
            } else if (sources?.length > 0) {
                for (let source of sources) {
                    let sourceLink = this.links[`${source}-${id}`] || this.links[`${source}-${alias}`]

                    // Not found? Check plurals.
                    if (!sourceLink && settings.links.autoPlural) {
                        sourceLink = this.links[`${source}-${id}s`] || this.links[`${source}-${alias}s`]
                    }

                    // Link found!
                    if (sourceLink) {
                        foundLinks.push(sourceLink)
                    }
                }
            }

            // No direct links found yet? Fallback to search.
            if (foundLinks.length == 0 && search) {
                for (let source of sources) {
                    const sourceLink = this.links[`${source}-search`]
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

            // Filter only links relevant to the specified country.
            const countryAlias = countryManager.aliases[country]
            const countryLinks = foundLinks.filter((link) => link.urls[country] || link.urls[countryAlias] || link.urls.any)

            // No links found?
            if (countryLinks.length == 0) {
                logger.warn("LinkManager.urlFor", id, `${search ? "Search" : "Link"} not found for country ${country}`)
                return null
            }

            // Generate the target URL.
            const singleLink = _.sample(countryLinks)
            const result: TargetURL = {
                url: _.sample(singleLink.urls[country] || singleLink.urls[countryAlias] || singleLink.urls.any),
                source: singleLink.source
            }

            // If it's a search, replace the query tag.
            if (search) {
                result.url = result.url.replace("{{query}}", getSearchQuery(id, result.source))
            }

            logger.info("LinkManager.urlFor", id, country, sourcesLog, result.url)
            return result
        } catch (ex) {
            logger.error("LinkManager.urlFor", id, country, sourcesLog, ex)
            return null
        }
    }
}

export default LinkManager.Instance
