// COUNTRY LINKIFY: START

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development"
}

// Setup the logger.
import logger from "anyhow"
logger.setup("console")
logger.setOptions({
    appName: "Country Linkify",
    timestamp: false,
    levelOnConsole: true,
    preprocessors: ["friendlyErrors", "maskSecrets"]
})

// Check if JSON logging (for Google Cloud Logging) should be used instead of simple text.
if (process.env.NODE_ENV == "production" && process.env.JSON_LOGGING) {
    const consoleLog = (level, message) => {
        level = level.toUpperCase()
        if (level == "WARN") level = "WARNING"
        console.log(JSON.stringify({severity: level, message: message}))
    }
    const gcloudLogging = {
        name: "gcloud",
        log: consoleLog
    }

    logger.setOptions({levelOnConsole: false})
    logger.info("CountryLinkify.startup", "Switching to JSON logging now")
    logger.setup(gcloudLogging)
}

// Flag if the server is shutting down.
let terminating = false

// Set it to gracefully shutdown.
// Shutdown script.
const shutdown = async (code) => {
    if (terminating) return
    terminating = true

    // Code defaults to 0.
    if (!code) code = 0

    logger.warn("CountryLinkify.shutdown", `Code ${code}`, "Terminating the service now...")
    process.exit()
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

import startup from "./index"
startup()
