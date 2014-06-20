var mfd = function() {

	var extensionDetected = false;
	var incmt = 0;

	var attach = function(resultFunc) {
		var result = {};
		var browser = detectBrowser();

		setTimeout(function() {
			if (browser == 'Chrome') {
				detectChromePlugin(function(restulStatus) {
					if (restulStatus.status == 'OK') {
						result.status = 'OK';
						result.downloader = getChromeDownloader();
					} else if (restulStatus.status == 'NOT_INSTALLED') {
						result.status = 'AVAILABLE';
						result.addonUrl = "http://chrome.google.com/webstore/detail/multiple-file-downloader/ijodceacahodmjmdmfcobdepogaajbpc";
					} else {
						result.status = 'UNAVAILABLE';
					}
					resultFunc(result);
				});
			} else {
				result.status = 'UNAVAILABLE';
				resultFunc(result);
			}
		}, 10);

	}

	function getChromeDownloader() {
		var functArray = [];
		var anchorTagCount = getAnchorTags().length;

		// this will initiate to download where objAry will be array of
		// of anchor tags which user want to download
		// path is optional and will be relative to the default Downloads folder
		var initiate = function(objAry, path) {

			var errMsg = "initiate() expects collection of anchor elements";

			if (!objAry.length) {
				return;
			}

			var divtag = document.getElementById("mfd-downloader-initiate-section");

			if (divtag != null) {
				divtag.remove();
			}
			var newdiv = document.createElement('div');
			newdiv.setAttribute('id', 'mfd-downloader-initiate-section');

			if(path){
				newdiv.setAttribute("mfd-downloader-path", path);
			}

			newdiv.style.position = "absolute";
			newdiv.style.left = 0;
			newdiv.style.top = 0;

			for (var i = 0; i < objAry.length; i++) {
				if (objAry[i].getAttribute) {
					var newinpt = document.createElement('input');
					newinpt.setAttribute('type', 'hidden');
					newinpt.setAttribute('mfd-downloader-select-href', objAry[i].getAttribute('href'));
					newinpt.setAttribute('mfd-downloader-select-download', objAry[i].getAttribute('download'));
					newdiv.appendChild(newinpt);
				} else
					throw errMsg;
			}
			document.body.appendChild(newdiv);
		}

		// this will insert watch hidden tag in dom if user wish to watch and 
		// will return array of all elements those are anchor tags with href and download
		var watch = function(paramFunc) {

			functArray.push(paramFunc);

			var inputTag = document.getElementById("mfd-downloader-watch-id");

			if (inputTag == null) {

				var newinpt = document.createElement('input');
				newinpt.setAttribute('type', 'hidden');
				newinpt.setAttribute('id', 'mfd-downloader-watch-id');
				newinpt.addEventListener('change', updateWatchResult, false);

				document.body.appendChild(newinpt);
			}
		}

		// get executed when content_script triggers onchange event
		// and this returns list of anchor tags into a funtion
		function updateWatchResult() {

			var currentAnchorTagCount = getAnchorTags().length;
			if (currentAnchorTagCount === anchorTagCount)
				return;
			else
				anchorTagCount = currentAnchorTagCount;

			var elementAry = [];
			elementAry = getAnchorTags();

			for (var i in functArray) {
				try {
					if (typeof(functArray[i] == "function"))
						functArray[i](elementAry);
				} catch (err) {}
			}
		}

		// gets all anchor tags and prepare array
		function getAnchorTags() {

			var ary = [];

			var aTaglist = document.getElementsByTagName("a");

			for (var i = 0; i < aTaglist.length; i++) {
				if (aTaglist[i].getAttribute("href") && aTaglist[i].getAttribute("download"))
					ary.push(aTaglist[i]);
			}
			return ary;
		}

		return {
			initiate: initiate,
			watch: watch,
			getAnchorTags: getAnchorTags
		};

	}

	function detectBrowser() {

		if (navigator.userAgent) {
			if (navigator.userAgent.indexOf("MSIE") > 0) {
				return "IE";
			} else if (navigator.userAgent.indexOf("Chrome") > 0) {
				return "Chrome";
			} else if (navigator.userAgent.indexOf("Firefox") > 0) {
				return "Firefox";
			} else if (navigator.userAgent.indexOf("Safari") > 0) {
				return "Safari";
			} else
				return "Other";
		}
	}

	function detectChromePlugin(waitFunc) {

		var inputTag = document.getElementById("mfd-downloader-detect-extension-id");

		if (inputTag != null) {
			inputTag.remove();
		}

		var newinpt = document.createElement('input');
		newinpt.setAttribute('type', 'hidden');
		newinpt.setAttribute('id', 'mfd-downloader-detect-extension-id');
		newinpt.addEventListener('change', function() {
			checkForExtension(true)
		}, false);

		document.body.appendChild(newinpt);

		waitForExtension(waitFunc);
	}

	function checkForExtension(val) {
		extensionDetected = val;
	}


	function waitForExtension(waitFunc) {

		var intervalId = setInterval(function() {
			incmt++;
			if (extensionDetected || incmt >= 10) {
				if (extensionDetected) {
					try {
						waitFunc({
							status: 'OK'
						});
					} catch (err) {
						clearInterval(intervalId);
						throw err;
					}
				} else {
					try {
						waitFunc({
							status: 'NOT_INSTALLED'
						});
					} catch (err) {
						clearInterval(intervalId);
						throw err;
					}

				}
				clearInterval(intervalId);
			}
		}, 50);
	}

	return {
		attach: attach
	};

}();