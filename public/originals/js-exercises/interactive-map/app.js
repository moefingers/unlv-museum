// map object
const myMap = {
	coordinates: [],
	businesses: [],
	map: {},
	markers: {},

	// build leaflet map
	buildMap() {
		this.map = L.map('map', {
		center: this.coordinates,
		zoom: 11,
		});
		// add openstreetmap tiles
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution:
			'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		minZoom: '15',
		}).addTo(this.map)
		// create and add geolocation marker
		const marker = L.marker(this.coordinates)
		marker
		.addTo(this.map)
		.bindPopup('<p1><b>You are here</b><br></p1>')
		.openPopup()
	},

	// add business markers
	addMarkers() {
		for (var i = 0; i < this.businesses.length; i++) {
		this.markers = L.marker([
			this.businesses[i].lat,
			this.businesses[i].long,
		])
			.bindPopup(`<p1>${this.businesses[i].name}</p1>`)
			.addTo(this.map)
		}
	},
}

// get coordinates via geolocation api
// museum-ready: 3s timeout + Las Vegas fallback so the map still loads when
// geolocation is blocked, denied, or unavailable in the museum's sandboxed
// iframe. The `original` branch retains the unguarded version that hangs
// forever without permission.
async function getCoords(){
	const fallback = [36.1084, -115.1440]
	if (!navigator.geolocation) return fallback
	try {
		const pos = await new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => reject(new Error('geolocation timeout')), 3000)
			navigator.geolocation.getCurrentPosition(
				(p) => { clearTimeout(timeoutId); resolve(p) },
				(e) => { clearTimeout(timeoutId); reject(e) },
				{ timeout: 3000 }
			)
		});
		return [pos.coords.latitude, pos.coords.longitude]
	} catch {
		return fallback
	}
}

// museum-ready: the Foursquare API key the original shipped (committed to
// client JS, the way the assignment was taught) was redacted before this
// branch went public. The `original` branch retains the historical
// commit. With FOURSQUARE_API_KEY redacted, the business-search button
// returns an empty result list and the map continues to function for the
// "you are here" pin + tile layer.
const FOURSQUARE_API_KEY = '<redacted-for-museum>'

// get foursquare businesses
async function getFoursquare(business) {
	if (FOURSQUARE_API_KEY === '<redacted-for-museum>' || !FOURSQUARE_API_KEY) {
		console.warn('[interactive-map] Foursquare API key redacted for museum; business search disabled.')
		return []
	}
	const options = {
		method: 'GET',
		headers: {
		Accept: 'application/json',
		Authorization: FOURSQUARE_API_KEY
		}
	}
	let limit = 5
	let lat = myMap.coordinates[0]
	let lon = myMap.coordinates[1]
	let response = await fetch(`https://api.foursquare.com/v3/places/search?&query=${business}&limit=${limit}&ll=${lat}%2C${lon}`, options)
	let data = await response.text()
	let parsedData = JSON.parse(data)
	let businesses = parsedData.results
	return businesses
}
// process foursquare array
function processBusinesses(data) {
	let businesses = data.map((element) => {
		let location = {
			name: element.name,
			lat: element.geocodes.main.latitude,
			long: element.geocodes.main.longitude
		};
		return location
	})
	return businesses
}


// event handlers
// window load
window.onload = async () => {
	const coords = await getCoords()
	myMap.coordinates = coords
	myMap.buildMap()
}

// business submit button
document.getElementById('submit').addEventListener('click', async (event) => {
	event.preventDefault()
	let business = document.getElementById('business').value
	let data = await getFoursquare(business)
	myMap.businesses = processBusinesses(data)
	myMap.addMarkers()
})
