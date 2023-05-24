// COUNTRY LINKIFY: TYPES

/**
 * Represents a link with a category and one target URL per country.
 */
export interface Link {
    id: string
    source: string
    urls: {[country: string]: string[]}
}

/**
 * Represents a target URL and its source.
 */
export interface SourceUrl {
    source: string
    url: string
}
