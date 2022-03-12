/**
 * Optimized leaflet canvas renderer to load numerous markers
 *
 * @link https://stackoverflow.com/a/51852641
 * @link https://stackoverflow.com/a/43019740
 *
 */
L.KMZMarker = L.CircleMarker.extend({
	// initialize: function(latlng, options) {
	// 	L.CircleMarker.prototype.initialize.call(this, latlng, options);
	// },
	_updatePath: function() {
		var renderer = this._renderer;
		var icon = this._icon;
		var layer = this;

		if (!renderer._drawing || layer._empty()) {
			return;
		}

		// if (icon.complete)
		if (icon) {
			icon.drawImage();
		} else {
			var original = this.options.iconSize === null;
			icon = this._icon = new Image(original ? 0 : this.options.iconSize[0], original ? 0 : this.options.iconSize[1]);
			icon.scale = this.options.iconScale;
			icon.anchor = icon.iconAnchor ? icon.iconAnchor : [icon.width / 2.0, icon.height / 2.0];
			icon.heading = this.options.iconHeading;
			icon.onload = icon.drawImage = () => {
				var isLoaded = icon.complete && icon.naturalHeight !== 0;
				if(isLoaded) {
					if (icon.height === 0) {
						if (icon.naturalWidth <= icon.naturalHeight) {
							icon.width = 28;
							icon.height = icon.naturalHeight * 28.0 / icon.naturalWidth;
						} else {
							icon.height = 28;
							icon.width = icon.naturalWidth * 28.0 / icon.naturalHeight;
						}
						icon.anchor = [icon.width / 2.0, icon.height / 2.0];
					}

					if(icon.scale !== 1) {
						icon.width *= icon.scale;
						icon.height *= icon.scale;
						icon.anchor = [icon.width / 2.0, icon.height / 2.0];
						icon.scale = 1;
					}

					var p = layer._point;
					var ctx = renderer._ctx;
					if(icon.heading !== 0) {
						ctx.save();
						ctx.translate(p.x, p.y);
						ctx.rotate(icon.heading * Math.PI / 180);
						ctx.drawImage(icon, -icon.anchor[0], -icon.anchor[1], icon.width, icon.height);
						ctx.restore();
					} else {
						p = p.subtract(icon.anchor);
						ctx.drawImage(icon, p.x, p.y, icon.width, icon.height);
					}
				}
				// Removed in Leaflet 1.4.0
				// if (renderer._drawnLayers) renderer._drawnLayers[layer._leaflet_id] = layer;
				// else renderer._layers[layer._leaflet_id] = layer;
			};
			icon.src = this.options.iconUrl;
		}
	}
});

L.kmzMarker = function(ll, opts) {
	return new L.KMZMarker(ll, opts);
};

export var KMZMarker = L.KMZMarker;
