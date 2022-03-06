import {strFromU8, unzip as unzipAsync} from "fflate";
import { kml as kmlToGeoJSON } from '@tmcw/togeojson';

export function loadFile(url) {
	return new Promise((resolve, reject) => {
		let xhr = new XMLHttpRequest();
		xhr.open('GET', url);
		xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		xhr.responseType = "arraybuffer";
		xhr.onload = () => {
			if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 0)) {
				resolve(xhr.response || xhr.responseText);
			} else {
				resolve('');
			}
		};
		xhr.onerror = () => reject("Error " + xhr.status + " while fetching remote file: " + url);
		xhr.send();
	});
}

export function getKmlDoc(files) {
	return files["doc.kml"] ? "doc.kml" : getKmlFiles(Object.keys(files))[0];
}

export function getKmlFiles(files) {
	return files.filter((file) => isKmlFile(file));
}

export function getImageFiles(files) {
	return files.filter((file) => isImageFile(file));
}

export function getFileExt(filename) {
	return filename.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
}

export function getFileName(url) {
	return url.split('/').pop();
}

export function getMimeType(filename, ext) {
	var mime = 'text/plain';
	if (/\.(jpe?g|png|gif|bmp)$/i.test(filename)) {
		mime = 'image/' + ext;
	} else if (/\.kml$/i.test(filename)) {
		mime = 'text/plain';
	}
	return mime;
}

export function isImageFile(filename) {
	return /\.(jpe?g|png|gif|bmp)$/i.test(filename);
}

export function isKmlFile(filename) {
	return /.*\.kml/.test(filename);
}

/**
 * It checks if a given file begins with PK, if so it's zipped
 *
 * @link https://en.wikipedia.org/wiki/List_of_file_signatures
 */
export function isZipped(file) {
	return 'PK' === String.fromCharCode(new Uint8Array(file, 0, 1), new Uint8Array(file, 1, 1));
}

export function parseLatLonBox(xml) {
	let box = L.latLngBounds([
		xml.getElementsByTagName('south')[0].childNodes[0].nodeValue,
		xml.getElementsByTagName('west')[0].childNodes[0].nodeValue
	], [
		xml.getElementsByTagName('north')[0].childNodes[0].nodeValue,
		xml.getElementsByTagName('east')[0].childNodes[0].nodeValue
	]);
	let rotation = xml.getElementsByTagName('rotation')[0];
	if (rotation !== undefined) {
		rotation = parseFloat(rotation.childNodes[0].nodeValue);
	}
	return [box, rotation];
}

export function parseGroundOverlay(xml, props) {
	let [bounds, rotation] = parseLatLonBox(xml.getElementsByTagName('LatLonBox')[0]);
	let href = xml.getElementsByTagName('href')[0];
	let color = xml.getElementsByTagName('color')[0];
	let icon = xml.getElementsByTagName('Icon')[0];
	let options = {};
	if (!href && icon) {
		href = icon.getElementsByTagName('href')[0];
	}
	href = href.childNodes[0].nodeValue;
	href = props.icons[href] || href;
	if (color) {
		color = color.childNodes[0].nodeValue;
		options.opacity = parseInt(color.substring(0, 2), 16) / 255.0;
		options.color = '#' + color.substring(6, 8) + color.substring(4, 6) + color.substring(2, 4);
	}
	if (rotation) {
		options.rotation = rotation;
	}
	return new L.KMZImageOverlay(href, bounds, { opacity: options.opacity, angle: options.rotation });
}

export function toGeoJSON(xml, props) {
	var json = kmlToGeoJSON(xml);
	json.properties = L.extend({}, json.properties, props || {});
	return json;
}

export function toXML(data) {
	var text = data;
	if (data instanceof ArrayBuffer) {
		data = new Uint8Array(data);
	}
	if (data instanceof Uint8Array) {
		text = strFromU8(data);
		var encoding = text.substring(0, text.indexOf("?>")).match(/encoding\s*=\s*["'](.*)["']/i);
		if (encoding && encoding[1].toUpperCase() !== "UTF-8") {
			text = new TextDecoder(encoding[1]).decode(data);
		}
	}
	return text ? (new DOMParser()).parseFromString(text, 'text/xml') : document.implementation.createDocument(null, "kml");;
}

export function unzip(folder) {
	return new Promise((resolve, reject) => {
		unzipAsync(new Uint8Array(folder), (err, unzipped) => {
			var files = Object.keys(unzipped)
				.map((name) => {
					var entry = unzipped[name];
					if (isImageFile(name)) {
						var ext = getFileExt(name);
						var mime = getMimeType(name, ext);

						return base64FromU8(entry)
							.then((value) =>
								[name, 'data:' + mime + ';base64,' + value]);
					}
					return new Promise((r) =>
						r([name, entry])); // [ fileName, stringValue ]
				});

			// Return KMZ files.
			Promise.all(files).then((list) =>
				resolve(list.reduce((obj, item) => {
					obj[item[0]] = item[1]; // { fileName: stringValue }
					return obj;
				}, {}))
			);
		});
	});
}

export function readFile(file) {
	return new Promise((resolve, reject) => {
		var fr = new FileReader();
		fr.onload = () => resolve(fr.result);
		fr.readAsArrayBuffer(file);
	});
}

function base64FromU8(array) {
	return new Promise((resolve) => {
		const reader = new FileReader()
		reader.onload = () => {
			/*
				The result looks like
				"data:application/octet-stream;base64,<your base64 data>",
				so we split off the beginning
			*/
			resolve(reader.result.split(",", 2)[1]);
		}
		reader.readAsDataURL(new Blob([array]))
	})
}
