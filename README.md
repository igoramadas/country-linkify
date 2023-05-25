# Country Linkify

Simple Node.js service to redirect links based on the client's country and link ID.

This repo is tailored to Devv's use cases, but feel free to use the code for your own purposes simply by having your own link definitions on the [/links](https://github.com/igoramadas/country-linkify/tree/master/links) folder.

## Link definitions

All links should be defined in .json files under the [/links](https://github.com/igoramadas/country-linkify/tree/master/links) folder. Each file represents a `source`, for example, a specific website or category of links.

Each key inside the JSON specs represents a link ID, and the target URLs by country. If a key gets a single string as its value, this will be the URL valid for any country.

There are also 2 standard keys, prefixed with an underscore:

- **_default**: the default target URL(s) for that source.
- **_search**: URL for the search page of the source, must have a `{{query}}` tag defined

A sample definition for "Amazon":

```json
{
  "_default": {
    "de": "https://www.amazon.de/",
    "us": "https://www.amazon.com/",
    "uk": "https://www.amazon.co.uk/"
  },
  "_search": {
    "us": "https://www.amazon.com/s?k={{query}}",
  },
  "deals": {
    "de": "https://www.amazon.de/-/en/deals",
    "us": "https://www.amazon.com/gp/goldbox",
    "uk": "https://www.amazon.co.uk/gp/deals"
  },
  "help": "https://www.amazon.com/gp/help/customer/display.html"
}
```

And a second file for "AliExpress":


```json
{
  "_default": "https://aliexpress.com",
  "_search": {
    "de": "https://de.aliexpress.com/w/{{query}}.html",
  },
  "deals": {
    "de": "https://www.aliexpress.com/sp/campaign/wow/gcp-plus/300000444/njcQZ4CkBb",
  }
}
```

With the samples above, a user from Germany (de) will get redirected to the following target URLs:

- **/l/amazon**: https://www.amazon.de/
- **/l/amazon-help**: https://www.amazon.com/gp/help/customer/display.html
- **/l/amazon-deals**: https://www.amazon.de/-/en/deals
- **/l/deals**: https://www.amazon.de/-/en/deals or https://www.aliexpress.com/sp/campaign/wow/gcp-plus/300000444/njcQZ4CkBb
- **/s/some-item**: https://de.aliexpress.com/w/some-item.html

And the results for someone from US:

- **/l/amazon**: https://www.amazon.com/
- **/l/amazon-help**: https://www.amazon.com/gp/help/customer/display.html
- **/l/amazon-deals**: https://www.amazon.com/gp/goldbox
- **/s/some-item**: "https://www.amazon.com/s?k=some+item"

## Settings

This tool is using the [SetMeUp](https://github.com/igoramadas/setmeup) module to handle its settings, so for detailed info please check its [docs](https://setmeup.devv.com).

-   **settings.json** - settings shared by all environments, targeting production by default
-   **settings.development.json** - development settings, mostly when running on your dev machine
-   **settings.production.json** - production-only settings, except credentials and secrets (optional)
-   **settings.local.json** - private local-only settings, excluded from the GIT repo

Settings are self explanatory, please open each file to check the available options.
