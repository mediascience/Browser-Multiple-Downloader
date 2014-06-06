var MSIDownloader={
		anchors:null,
		observer:null,
		initalized:false,
		stopped:false,

		init:function() {
			//console.log("initialize content_script");
			//only initialize once
			if(MSIDownloader.initialized) {
				//already initialized so just restart observing
				MSIDownloader.startObserving();
				return;
			}
			MSIDownloader.initialized=true;
			
			//page just loaded so check for download anchors, and notify background page
			MSIDownloader.checkForAnchors();

			//create an observer instance to listen for anchor changes
			MSIDownloader.observer=new MutationObserver(function(mutations) {
				var doCheck=false;
				mutations.forEach(function(mutation) {
					if(mutation.addedNodes || mutation.removedNodes) {
						doCheck=true;
					}
				});
				//if anchors changed in the page, tell the background
				if(doCheck) {
					MSIDownloader.checkForAnchors();
				}
			});

			//page just loaded so start observing download anchor changes
			MSIDownloader.observer.observe(document.body,{"childList":true,"attributes":true,"characterData":false,"subtree":true});
		},

		startObserving:function() {
			MSIDownloader.stopped=false;
			
			//console.log("inject startObserving:"+window.location);
			//background page is saying that this is the active page
			//so check the anchors immediately, and start observing changes for this page
			MSIDownloader.checkForAnchors();
			MSIDownloader.observer.observe(document.body,{"childList":true,"attributes":true,"characterData":false,"subtree":true});
		},

		stopObserving:function() {
			//console.log("inject stopObserving:"+window.location);
			//background page is saying that another page is the active page
			//so stop observing changes for this page
			MSIDownloader.observer.disconnect;
			//console.log("inject stopped observing:"+window.location);
			MSIDownloader.stopped=true;
		},

		checkForAnchors:function() {
			//console.log("inject checkForAnchors:"+window.location);
			if(MSIDownloader.stopped) {
				//console.log("inject checkForAnchors stopped");
				return;
			}
			//get all anchors that have an href and a download tag
			MSIDownloader.anchors=document.querySelectorAll("a[href][download]");

			//tell background page to show or hide the page action icon
			//in a dynamic page, downloads may have disappeared or appeared 
			var request=document.createTextNode(JSON.stringify({"enableDownloader":MSIDownloader.anchors.length>0}));

			//remove this request after downloader.js responds to it
			request.addEventListener("MSIDownloader-response",function(event) {
				//console.log("inject MSIDownloader-response");
				request.parentNode.removeChild(request);
			},false);

			//send the request to downloader.js using a custom event
			document.head.appendChild(request);
			//console.log("inject MSIDownloader-query");
			var event=document.createEvent("HTMLEvents");
			event.initEvent("MSIDownloader-query",true,false);
			request.dispatchEvent(event);
		}
};

