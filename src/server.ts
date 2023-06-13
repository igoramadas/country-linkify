// COUNTRY LINKIFY: LINKS HANDLER

import countryManager from "./countrymanager"
import linkManager from "./linkmanager"
import express = require("express")
import fs = require("fs")
import logger = require("anyhow")
import jaul = require("jaul")
import path = require("path")
const settings = require("setmeup").settings

export class Server {
    private constructor() {}
    private static _instance: Server
    static get Instance() {
        return this._instance || (this._instance = new this())
    }

    /**
     * The Express application.
     */
    app: express.Express

    /**
     * Setup the routes and start the HTTP server.
     */
    init = async (): Promise<void> => {
        if (!settings.server.url) {
            throw new Error(`Missing "server.url" on settings`)
        }
        if (!settings.server.port) {
            throw new Error(`The "server.port" must be a valid port number`)
        }
        if (!settings.server.apiKey) {
            throw new Error(`Missing "server.apiKey" on settings`)
        }
        if (!settings.server.apiToken) {
            throw new Error(`Missing "server.apiToken" on settings`)
        }

        this.app = express()

        // Log all request if debug is enabled.
        if (settings.debug) {
            const routeLogger = (_req, _res, _next) => {
                logger.debug("Server.route", _req.originalUrl)
                _next()
            }

            this.app.use("*", routeLogger)
        }

        // Static routes.
        this.app.get(`/`, this.indexRoute)
        this.app.get(`/404`, this.notFoundRoute)

        // API for direct links and search.
        this.app.get(`/${settings.server.apiKey}/list`, this.apiListRoute)
        this.app.get(`/l/:id`, this.linkRoute)
        this.app.get(`/s/:search`, this.linkRoute)

        // Static files.
        this.app.use(express.static(path.join(__dirname, "../assets")))

        // Start the server.
        this.app.listen(settings.server.port, () => logger.info("Server", `Listeing on port ${settings.server.port}`))
    }

    // ROUTES
    // ------------------------------------------------------------------------

    /**
     * Homepage route.
     */
    indexRoute = async (req: express.Request, res: express.Response) => {
        logger.debug("Server.indexRoute", req.originalUrl)
        res.redirect(settings.app.homeUrl || "/404")
    }

    /**
     * Link not found will display list of links with logos instead.
     */
    notFoundRoute = async (req: express.Request, res: express.Response) => {
        logger.debug("Server.notFoundRoute", req.originalUrl)

        const template = fs.readFileSync(path.join(__dirname, "../assets/404.html"), "utf8")
        const linkIds = Object.keys(linkManager.links)
        const logoIds = []

        // Check all links, and filter only the ones that have a logo image.
        for (let id of linkIds) {
            const imagePath = path.join(__dirname, `../assets/images/${id}.png`)
            if (fs.existsSync(imagePath)) {
                logoIds.push(id)
            }
        }

        const aTags = logoIds.map((id) => `<a href="https://links.devv.com/l/${id}"><img src="/images/${id}.png" /></a>`)
        res.send(jaul.data.replaceTags(template, {logos: aTags.join(" ")}))
    }

    /**
     * Main link redirection route.
     */
    linkRoute = async (req: express.Request, res: express.Response) => {
        let ip = this.getClientIP(req)
        let country = await this.getClientCountry(req, ip)
        let countryLog = country

        // Could not fetch country? Use the default.
        if (!country) {
            country = settings.country.default
            countryLog = `default ${settings.country.default}`
        }

        const search = req.params.search
        const linkId = decodeURIComponent(req.params.id || search)
        const sources = req.query.sources ? req.query.sources.toString().split(",") : null
        const target = linkManager.urlFor(linkId, country, sources, search ? true : false)

        if (!target) {
            logger.debug("Server.linkRoute", req.params.id, "404")
            res.redirect("/404")
            return
        }

        logger.debug("Server.linkRoute", req.params.id, target)

        // Redirect straight away unless the rn query is set.
        if (req.query.rn != "1") {
            logger.info("Server.linkRoute", req.params.id, `IP: ${ip}`, `Country: ${countryLog}`, target.source, target.url)
            res.redirect(target ? target.url : "/404")
            return
        }

        const template = fs.readFileSync(path.join(__dirname, "../assets/redir.html"), "utf8")
        const tags = {
            from: req.query.from || "Devv",
            target: target.source,
            url: target.url,
            logo: fs.existsSync(path.join(__dirname, `../assets/images/${target.source}.png`)) ? target.source : "nologo"
        }

        // Send template with replaced tags to the client.
        logger.info("Server.linkRoute", req.params.id, `IP: ${ip}`, `Country: ${countryLog}`, "Redirection notice", target.source, target.url)
        res.send(jaul.data.replaceTags(template, tags))
    }

    /**
     * Get full list of links registered on the system.
     */
    apiListRoute = async (req: express.Request, res: express.Response) => {
        if (!this.apiCheckCredentials(req, res)) return

        res.json(linkManager.links)
    }

    /**
     * Helper to check the credentials passed on API requests.
     */
    apiCheckCredentials = (req: express.Request, res: express.Response) => {
        const denied = {message: "Access denied"}

        try {
            const header = req.headers["authorization"]
            const token = header && header.indexOf(" ") > 0 ? header.split(" ")[1] : null

            // Check if the passed token is valid.
            if (token != settings.server.apiToken) {
                logger.warn("Server.apiCheckCredentials", req.originalUrl, "Access denied")
                res.status(401).json(denied)
                return false
            }
        } catch (ex) {
            logger.error("Server.apiCheckCredentials", req.originalUrl, ex)
            res.status(401).json(denied)
            return false
        }

        return true
    }

    // HELPERS
    // ------------------------------------------------------------------------

    /**
     * Get the client's IP address.
     * @param req Request object.
     */
    getClientIP = (req: express.Request): string => {
        const xfor = req.headers["x-forwarded-for"]

        if (xfor != null && xfor != "") {
            const ip = xfor.toString().split(",")[0]
            logger.debug("Server.getClientIP", req.originalUrl, `From header: ${ip}`)
            return ip
        }

        if (req.socket && req.socket.remoteAddress) {
            const ip = req.socket.remoteAddress
            logger.debug("Server.getClientIP", req.originalUrl, `From socket: ${ip}`)
            return ip
        }

        logger.debug("Server.getClientIP", req.originalUrl, `From req.ip: ${req.ip}`)
        return req.ip
    }

    /**
     * Get the client's country address based on headers and IP.
     * @param req Request object.
     * @param ip Optional, the client IP (in case it was parsed before).
     */
    getClientCountry = async (req: express.Request, ip?: string): Promise<string> => {
        if (!ip) ip = this.getClientIP(req)

        // When running locally, return default country.
        if (!ip || ip.includes("127.0.0.1")) {
            return settings.country.default
        }

        const cfHeader = req.headers["cf-ipcountry"]

        if (cfHeader) {
            logger.debug("Server.getClientCountry", `IP ${ip}`, `From CF header: ${cfHeader}`)
            return cfHeader.toString().toLowerCase()
        }

        const ipCountry = await countryManager.getForIP(ip)

        if (ipCountry) {
            logger.debug("Server.getClientCountry", `IP ${ip}`, `From IP: ${ipCountry}`)
            return ipCountry
        }

        return null
    }
}

export default Server.Instance
