// COUNTRY LINKIFY: TYPES

/**
 * Represents a link with a category and one target URL per country.
 */
export interface Link {
    id: "default" | "search" | string
    source: string
    urls: {[country: string]: string[]}
}

/**
 * Represents a target URL.
 */
export interface TargetURL {
    url: string
    source: string
}
