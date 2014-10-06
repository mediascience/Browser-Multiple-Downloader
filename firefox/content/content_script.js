var MSIDownloader={
		anchors:null,
		observer:null,
		initalized:false,
		stopped:false,
		extensionDetected:false,
		isWatching:false,

		init: function() {
			//only initialize once
			if (MSIDownloader.initialized) {
				//already initialized so just restart observing
				MSIDownloader.startObserving();
				return;
			}
			MSIDownloader.initialized = true;

			//page just loaded so check for download anchors, and notify background page
			MSIDownloader.checkForAnchors();
			//create an observer instance to listen for anchor changes
			MSIDownloader.observer = new MutationObserver(function(mutations) {
				var doCheck = false;
				mutations.forEach(function(mutation) {
					if (mutation.addedNodes || mutation.removedNodes) {
						doCheck = true;
					}
				});
				//if anchors changed in the page, tell the background
				if (doCheck) {
					MSIDownloader.checkForAnchors();

					// this will detect if extension is installed on the browser either
					if (!MSIDownloader.extensionDetected) {
						MSIDownloader.listenForDownloadExtensionDetect();
					}

					// this will listen for download files when user requests
					var downloadTask = MSIDownloader.listenForDownloadInitiate();

					// if it is not a download task, listen for changes in anchor tags and respond to use
					if (!downloadTask)
						MSIDownloader.listenFordownloadWatch();
				}
			});

			//page just loaded so start observing download anchor changes
			MSIDownloader.observer.observe(document.body, {
				"childList": true,
				"attributes": true,
				"characterData": false,
				"subtree": true
			});
		},

		startObserving:function() {
			MSIDownloader.stopped=false;
			
			//background page is saying that this is the active page
			//so check the anchors immediately, and start observing changes for this page
			MSIDownloader.checkForAnchors();
			MSIDownloader.observer.observe(document.body,{"childList":true,"attributes":true,"characterData":false,"subtree":true});
		},

		stopObserving:function() {
			//background page is saying that another page is the active page
			//so stop observing changes for this page
			MSIDownloader.observer.disconnect;
			MSIDownloader.stopped=true;
		},

		checkForAnchors:function() {		
			if(MSIDownloader.stopped) {
				return;
			}
			//get all anchors that have an href and a download tag
			MSIDownloader.anchors=document.querySelectorAll("a[href][download]");

			//tell background page to show or hide the page action icon
			//in a dynamic page, downloads may have disappeared or appeared 
			var request=document.createTextNode(JSON.stringify({"enableDownloader":MSIDownloader.anchors.length>0}));	
			//remove this request after downloader.js responds to it
			request.addEventListener("MSIDownloader-response",function(event) {
				request.parentNode.removeChild(request);
			},false);

			//send the request to downloader.js using a custom event
			document.head.appendChild(request);
			var event=document.createEvent("HTMLEvents");
			event.initEvent("MSIDownloader-query",true,false);
			request.dispatchEvent(event);
		},

		listenForDownloadInitiate: function() {
			var downloaderInitiateTag = document.querySelector("div[id='mfd-downloader-initiate-section']");
			
			// presence of download tag will indicate a call to downloader initiate
			if (downloaderInitiateTag) {
				var selected = [];

				// preparing array of href and download attributes
				var downloaderSelectTags = document.querySelectorAll("input[mfd-downloader-select-href][mfd-downloader-select-download]");
				var path = downloaderInitiateTag.getAttribute("mfd-downloader-path");
				if (downloaderSelectTags && downloaderSelectTags.length) {

					var i, selectTag;
					for (i = 0; i < downloaderSelectTags.length; i++) {
						selectTag = downloaderSelectTags[i];
						selected.push({
							"href": MSIDownloader.absolutePath(selectTag.getAttribute("mfd-downloader-select-href")),
							"download": MSIDownloader.fileName(selectTag.getAttribute("mfd-downloader-select-download"))
						});
					}
					//tell background page to initiate multiple download
					//in this case, path is location where user want to download
					var request=document.createTextNode(JSON.stringify({"initiateMultileDownload":true, "selected": selected, "path": path}));

					//remove this request after downloader.js responds to it
					request.addEventListener("MSIDownloader-response",function(event) {
						request.parentNode.removeChild(request);
					},false);

					//send the request to downloader.js using a custom event
					document.head.appendChild(request);
					var event=document.createEvent("HTMLEvents");
					event.initEvent("MSIDownloader-query",true,false);
					request.dispatchEvent(event);
				}
				downloaderInitiateTag.remove();
				return true;
			}
			return false;
		},

		absolutePath: function(href) {
			var a=document.createElement("a");
			a.href=href;
			return a.href;
		},

		fileName: function(path) {
			var i=path.lastIndexOf("/");
			var j=path.lastIndexOf("\\");
			i=(i>j?i:j);
			return (i>-1?path.substr(i+1):path);
		},

		listenForDownloadExtensionDetect: function() {
			var etag = document.getElementById('mfd-downloader-detect-extension-id');

			if (etag) {
				MSIDownloader.respondToInputTag(etag);
				MSIDownloader.extensionDetected = true;
			}
		},

		listenFordownloadWatch: function(){
			var etag = document.getElementById('mfd-downloader-watch-id');

			if(etag){
				if(MSIDownloader.isWatching)
					MSIDownloader.respondToInputTag(etag);
				else
					MSIDownloader.isWatching = true;
			}
		},

		// this will fire event onchange 
		respondToInputTag: function(etag) {
			if (etag.dispatchEvent) {
				var evt = document.createEvent("HTMLEvents");
				evt.initEvent("change", false, true);
				etag.dispatchEvent(evt);
			} else {
				etag.fireEvent("onchange");
			}
		}


};