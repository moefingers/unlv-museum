<!-- unlv-museum-banner-start -->
<a href="https://unlv-museum.infinite-syndicate.com/js-exercises/interactive-map" target="_blank" rel="noopener">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://unlv-museum.infinite-syndicate.com/github-banners/interactive-map?theme=dark&v=10ca0ba497">
    <img src="https://unlv-museum.infinite-syndicate.com/github-banners/interactive-map?theme=light&v=10ca0ba497" alt="Geolocation mapping in vanilla JS — the browser's GPS pin is plotted on a Leaflet + OpenStreetMap tile map, and a select-then-submit form queries the Foursquare Places API to drop nearby business markers around the user's location." width="100%">
  </picture>
</a>

> This `museum-ready/original` branch is the host-compatible build of the [`original` branch](https://github.com/moefingers/JS-Making-an-Interactive-Map/tree/original) — [audit the diff](https://github.com/moefingers/JS-Making-an-Interactive-Map/compare/original...museum-ready%2Foriginal): hosting fixes only (dead URLs, Node LTS floor, pnpm), behavior byte-for-byte. [Open in museum →](https://unlv-museum.infinite-syndicate.com/js-exercises/interactive-map)
<!-- unlv-museum-banner-end -->

# Project - Create an Interactive Map

This map utilizes the Leaflet library and Foursquare API to map the users geolocation coordinates onto a map. The user is then able to select a business type and have businesses add to the map.  

This project is meant to be completed independently. The code here may be used as a reference, but it is expected that every project will differ.

## Minimum Steps to Produce
* Get the user's current location.  
* Map that location on a Leaflet map.  
* Allow the user to select a business type from a select list and map the 5 nearest locations on the same map using the Foursquare API.
