import * as _ from './utils';
import Worker from 'web-worker:../dist/worker-util';

export const KMZLayer = L.KMZLayer = L.FeatureGroup.extend({
	options: {
		interactive: true,
		ballon: true,
		bindPopup: true,
		bindTooltip: true,
		preferCanvas: false,
		httpsRewrite: true,
		splitFolders: true,
		autoAdd: false,
		useOriginalIconSize: false, // the smaller between width and height will be set to 28
		maxSubFolders: 10, // < 0 = infinite
		supportBalloonLink: true // Experimental
	},
	popups: {},
	worker: false,

	initialize: function(kmzUrl, options) {
		L.extend(this.options, options);

		if (L.Browser.mobile) this.options.bindTooltip = false;

		this._layers = {};

		if (kmzUrl) this.load(kmzUrl);
	},

	add: function(kmzUrl) {
		this.load(kmzUrl);
	},

	load: function(kmzUrl) {
		this._load(kmzUrl);
	},

	loadFile: function(file) {
		_.readFile(file).then((data) => this._parse(data, { name: file.name, icons: {}}));
	},

	_load: function(url) {
		return _.loadFile(url).then((data) => this._parse(data, { name: _.getFileName(url), icons: {} }));
	},

	_parse: function(data, props) {
		return _.isZipped(data) ? this._parseKMZ(data, props) : this._parseKML(data, props);
	},

	_parseKMZ: function(data, props) {
		_.unzip(data).then((kmzFiles) => {
			var kmlDoc = _.getKmlDoc(kmzFiles);
			var images = _.getImageFiles(Object.keys(kmzFiles));

			var kmlString = kmzFiles[kmlDoc];
			// cache all images with their base64 encoding
			props.icons = images.reduce((obj, item) => {
				obj[item] = kmzFiles[item];
				return obj;
			}, {});

			this._parseKML(kmlString, props);
		});
	},

	_parseKML: function(data, props) {
		if(!this.worker) {
			this.worker = new Worker();
			var src = this;
			this.worker.onmessage = function(e) {
				if (e.data.loaded) {
					src.fire('loadComplete');
				} else {
					var name = e.data.name;
					var geojson = e.data.geojson;
					var groundOverlays = e.data.groundOverlays;
					var layer = (src.options.geometryToLayer || src._geometryToLayer).call(src, geojson, groundOverlays);
					src.addLayer(layer);
					if (!src.options.autoAdd) {
						layer.remove();
					}
					src.fire('load', {layer: layer, name: name});
				}
			}
		}
		this.worker.postMessage({
			xml: data,
			props: props,
			options: this.options
		});
	},

	_geometryToLayer: function(data, groundOverlays) {
		var preferCanvas = this._map ? this._map.options.preferCanvas : this.options.preferCanvas;
		var httpsRewrite = this.options.httpsRewrite;
		// parse GeoJSON
		var layer = L.geoJson(data, {
			pointToLayer: (feature, latlng) => {
				var iconUrl = data.properties.icons[feature.properties.icon];
				var scale = feature.properties['icon-scale'];
				if (!scale) {
					scale = 1;
				}
				var heading = feature.properties['icon-heading'];
				if (!heading) {
					heading = 0;
				}
				var size = 28;

				if (!iconUrl) {
					iconUrl = feature.properties.icon;
					if (httpsRewrite) {
						iconUrl = iconUrl.replace(/^http:\/\//i, 'https://');
					}
				}

				if (preferCanvas) {
					return L.kmzMarker(latlng, {
						iconUrl: iconUrl,
						iconSize: this.options.useOriginalIconSize ? null : [size, size],
						iconScale: scale,
						iconAnchor: [size / 2.0, size / 2.0],
						iconHeading: heading,
						interactive: this.options.interactive,
					});
				}
				size *= scale;
				// TODO: handle L.svg renderer within the L.KMZMarker class?
				return L.marker(latlng, {
					icon: L.icon({
						iconUrl: iconUrl,
						iconSize: [size, size],
						iconAnchor: [size / 2.0, size / 2.0],
					}),
					interactive: this.options.interactive,
				});
			},
			style: (feature) => {
				var styles = {};
				var prop = feature.properties;

				if (prop.stroke) {
					styles.stroke = true;
					styles.color = prop.stroke;
				}
				if (prop.fill) {
					styles.fill = true;
					styles.fillColor = prop.fill;
				}
				if (prop["stroke-opacity"]) {
					styles.opacity = prop["stroke-opacity"];
				}
				if (prop["fill-opacity"]) {
					styles.fillOpacity = prop["fill-opacity"];
				}
				if (prop["stroke-width"]) {
					styles.weight = prop["stroke-width"] * 1.05;
				}

				return styles;
			},
			onEachFeature: (feature, layer) => {
				if (!this.options.ballon) return;

				var prop = feature.properties;
				var name = prop.name || "";
				var desc = prop.description || "";

				if (name || desc) {
					if(desc && this.options.supportBalloonLink) {
						this.popups[name] = desc;
						var popups = this.popups;
						var regex = /href=["']#(.*);balloon["']/;
						layer.on("popupopen", function (e) {
							var content = e.popup.getContent();
							content = content.replace(regex, function (match, p1) {
								var text = popups[p1].replace("'", "\'");
								return "style=\"cursor:pointer\"" +
									"onclick=\"document.getElementsByClassName('leaflet-popup-content')[0].innerHTML=" +
									"'" + text + "'\"";
							});
							layer.setPopupContent(content);
						});
					}
					if (this.options.bindPopup) {
						layer.bindPopup('<div>' + '<b>' + name + '</b>' + '<br>' + desc + '</div>');
					}
					if (this.options.bindTooltip) {
						layer.bindTooltip('<b>' + name + '</b>', {
							direction: 'auto',
							sticky: true,
						});
					}
				}
				if (feature.geometry.type === "LineString") {
					try {
						const coordinates = feature.geometry.coordinates[0];
						for (let i = 3; i < coordinates.length; i += 3) {
							layer.addLatLng([coordinates[i + 1], coordinates[i]]);
						}
					} catch(ignored){};
				}
			},
			interactive: this.options.interactive,
			filter: (feature) => {
				return feature.geometry.type !== "Point" || feature.properties.icon;
			}
		});
		// parse GroundOverlays
		for (let l, k = 0; k < groundOverlays.length; k++) {
			l = _.parseGroundOverlay(groundOverlays[k], data.properties);
			if (l) {
				layer.addLayer(l);
			}
		}
		return layer;
	},
});

L.kmzLayer = function(url, options) {
	return new L.KMZLayer(url, options);
};
