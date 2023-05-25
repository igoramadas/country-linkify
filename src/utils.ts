// COUNTRY LINKIFY: UTILS

/**
 * Helper to get a valid search query value for the specified source.
 */
export const getSearchQuery = (id: string, source: string) => {
    if (source == "aliexpress") {
        return id.replace(/[^a-zA-Z ]/g, "").replace(/ /g, "-")
    }
    if (source == "decathlon" || source == "ribble") {
        return encodeURIComponent(encodeURIComponent(id))
    }

    return encodeURIComponent(id)
}
