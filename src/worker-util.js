import {kml as kmlToGeoJSON} from "@tmcw/togeojson";
import {strFromU8} from "fflate";
import {DOMParser} from "@xmldom/xmldom";
var options;

self.onmessage = function (e) {
    if (e.data) {
        var xml = toXML(e.data.xml);
        var props = e.data.props;
        options = e.data.options;
        if (options.splitFolders) {
            var style = getXMLElements(xml, 'Style').concat(getXMLElements(xml, 'StyleMap'));
            parseFolder(xml, "", props.name, props, style, false);
        } else {
            parseNode(xml, props.name, props, []);
        }
    }
};

function parseFolder(node, prefix, suffix, props, style, isFolder) {
    if (isFolder) {
        prefix += getXMLName(node);
    }
    var folders = node.getElementsByTagName("Folder");
    if (folders.length > 0) {
        var maxSubFolders = options.maxSubFolders;
        if(maxSubFolders < 0 || countXMLSubFolders(node, maxSubFolders) < maxSubFolders) {
            do {
                var folder = folders.item(0);
                parseFolder(folder, prefix, suffix, props, style, true);
                folder.parentNode.removeChild(folder);
            } while(folders.length > 0);
        }
    }
    return parseNode(node, prefix + suffix, props, style);
}

function parseNode(node, name, props, style) {
    for (let i=0; i<style.length; i++) {
        node.appendChild(style[i]);
    }
    var geojson = toGeoJSON(node, props);
    // skip empty layers
    var groundOverlays = getXMLElements(node, 'GroundOverlay');
    if (geojson.features.length > 0 || groundOverlays.length > 0) {
        postMessage({
            name: name,
            geojson: geojson,
            groundOverlays: groundOverlays
        });
    }
}

function toGeoJSON(xml, props) {
    var json = kmlToGeoJSON(xml);
    if (props) {
        json.properties = props;
    }
    return json;
}

function toXML(data) {
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

function getXMLName(node) {
    var nodeName = "";
    var temp = node.firstChild;
    while (temp != null) {
        if (temp.nodeType === 1 && temp.tagName === "name") {
            nodeName = temp.firstChild.nodeValue + " - ";
            break;
        }
        temp = temp.nextSibling;
    }
    return nodeName;
}

function countXMLSubFolders(node, max) {
    var count = 0;
    var temp = node.firstChild;
    while (temp != null && count < max) {
        if (temp.nodeType === 1 && temp.tagName === "Folder") {
            count++;
        }
        temp = temp.nextSibling;
    }
    return count;
}

function getXMLElements(node, tag) {
    let el = node.getElementsByTagName(tag);
    let arr = [];
    for (let k = 0; k < el.length; k++) {
        arr.push(el[k]);
    }
    return arr;
}