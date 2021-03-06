// COUNTRY LINKIFY: TYPES

/**
 * Represents a link with a category and one target URL per country.
 */
export interface Link {
    id: string
    category: string
    urls: {[country: string]: string[]}
}
