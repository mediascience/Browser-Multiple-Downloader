var mfd = function() {

	var extensionDetected = false;
	var anchorTagCount;
	var functArray = [];
	var mfdResult = {};
	var funcSlectFolder;

	var attach = function(resultFunc) {

		var browser = detectBrowser();


		if (browser == 'Chrome') {
			connectToPlugin(resultFunc, s_chrome_addonUrl, browser);
		} else if (browser == 'Firefox') {
			connectToPlugin(resultFunc, s_firefox_addonUrl, browser);
		} else if (browser == 'Safari') {
			connectToPlugin(resultFunc, s_safari_addonUrl, browser);
		} else {

			mfdResult.status = 'UNAVAILABLE';
			try {
				resultFunc(mfdResult);
			} catch (err) {
				throw err;
			}
		}
	}

	function connectToPlugin(resultFunc, addonUrl, detectedBrowser) {

		var incmt = 0;
		var skipCheck = false;
		// retry detecting extension every 50 ms. once found clear interval
		var intervalId = setInterval(function() {
			incmt++;

			detectPlugin(function(resultStatus) {
				if (!skipCheck) {
					if (resultStatus.status == 'OK') {
						skipCheck = true;
						mfdResult.status = 'OK';
						mfdResult.browser = detectedBrowser;
						mfdResult.downloader = getDownloader();
						if (detectedBrowser == 'Safari'){
							mfdResult.downloader.selectFolder = selectFolderPath;
						}
						clearInterval(intervalId);
						try {
							resultFunc(mfdResult);
						} catch (err) {
							throw err;
						}
						return;
					} else if (resultStatus.status == 'NOT_INSTALLED') {
						mfdResult.status = 'AVAILABLE';
						mfdResult.addonUrl = addonUrl;
					} else {
						mfdResult.status = 'UNAVAILABLE';
					}
					if (incmt >= 100) {
						skipCheck = true;
						clearInterval(intervalId);
						try {
							resultFunc(mfdResult);
						} catch (err) {
							throw err;
						}
					}
				}
			});
		}, 50);
	}

	function getDownloader() {
		anchorTagCount = getAnchorTags().length;

		// this will initiate to download where objAry will be array of
		// of anchor tags which user want to download
		// path is optional and will be relative to the default Downloads folder
		var initiate = function(objAry, path) {

			var errMsg = "initiate() expects collection of anchor elements";

			if (!objAry.length) {
				return;
			}

			var divtag = document.getElementById(s_download_initiate);

			if (divtag != null) {
				divtag.remove();
			}
			var newdiv = document.createElement('div');
			newdiv.setAttribute(s_id, s_download_initiate);

			if (path) {
				newdiv.setAttribute(s_download_path, path);
			}

			newdiv.style.position = "absolute";
			newdiv.style.left = 0;
			newdiv.style.top = 0;

			for (var i = 0; i < objAry.length; i++) {
				if (objAry[i].getAttribute) {
					var newinpt = document.createElement(s_input);
					newinpt.setAttribute(s_type, s_hidden);
					newinpt.setAttribute(s_download_select_href, objAry[i].getAttribute('href'));
					newinpt.setAttribute(s_download_select_download, objAry[i].getAttribute('download'));
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

			var inputTag = document.getElementById(s_download_watch_id);

			if (inputTag == null) {

				var newinpt = document.createElement(s_input);
				newinpt.setAttribute(s_type, s_hidden);
				newinpt.setAttribute(s_id, s_download_watch_id);
				newinpt.addEventListener(s_change, updateWatchResult, false);

				document.body.appendChild(newinpt);
			}
		}

		return {
			initiate: initiate,
			watch: watch,
			getAnchorTags: getAnchorTags
		};

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


	// when user calls selectFolder method, insert a input tag
	// so that content_script can notice for this request
	function selectFolderPath(paramFunc) {

		funcSlectFolder = paramFunc;
		var inputTag = document.getElementById(s_download_select_folder_id);

		if (inputTag != null)
			inputTag.remove();

		var newinpt = document.createElement(s_input);
		newinpt.setAttribute(s_type, s_hidden);
		newinpt.setAttribute(s_id, s_download_select_folder_id);
		newinpt.addEventListener(s_change, returnFolderPath, false);

		document.body.appendChild(newinpt);

	}

	// retuns a selected safari folder path if user has selected else return null
	function returnFolderPath() {

		var inputTag = document.getElementById(s_download_select_folder_id);

		if (inputTag != null) {
			var pathVal = inputTag.getAttribute(s_download_path);

			if (pathVal)
				funcSlectFolder(pathVal);
			inputTag.remove();
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
		} else
			return "userAgent undefined";
	}

	function detectPlugin(waitFunc) {

		var inputTag = document.getElementById(s_detect_extension_id);
		var newinpt = document.createElement(s_input);
		newinpt.setAttribute(s_type, s_hidden);
		newinpt.setAttribute(s_detect_extension_attr, 'true');
		newinpt.setAttribute(s_id, s_detect_extension_id);
		newinpt.addEventListener(s_change, function() {
			checkForExtension(true)
		}, false);

		document.body.appendChild(newinpt);

		waitForExtension(waitFunc, s_detect_extension_attr);
	}	

	function checkForExtension(val) {
		extensionDetected = val;
	}

	function waitForExtension(waitFunc, attributName) {
		var incmt = 0;
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
				var detectTags = document.querySelectorAll('input[' + attributName + ']');
				for (var i = 0; i < detectTags.length; i++) {
					detectTags[i].remove();
				}
			}
		}, 50);
	}

	// All constant strings
	var s_detect_extension_id = 'mfd-downloader-detect-extension-id';
	var s_detect_extension_attr = 'mfd-downloader-detect-extension';
	var s_download_watch_id = 'mfd-downloader-watch-id';
	var s_download_initiate = 'mfd-downloader-initiate-section';
	var s_download_path = 'mfd-downloader-path';
	var s_download_select_href = 'mfd-downloader-select-href';
	var s_download_select_download = 'mfd-downloader-select-download';
	var s_download_select_folder_id = 'mfd-downloader-select-folder-id';
	var s_id = 'id';
	var s_input = 'input';
	var s_hidden = 'hidden';
	var s_change = 'change';
	var s_type = 'type';

	var s_chrome_addonUrl = "http://chrome.google.com/webstore/detail/multiple-file-downloader/ijodceacahodmjmdmfcobdepogaajbpc";
	var s_firefox_addonUrl = "https://addons.mozilla.org/en-US/firefox/addon/multiple-file-downloader/";
	var s_safari_addonUrl = "https://d2w5u6kh8b1gme.cloudfront.net/safari-extension/MSI-Multiple-File-Downloader.pkg";

	return {
		attach: attach
	};

}();