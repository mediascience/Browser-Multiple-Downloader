Components.utils.import("resource://gre/modules/Downloads.jsm");
Components.utils.import("resource://gre/modules/osfile.jsm");
Components.utils.import("resource://gre/modules/Task.jsm");

var MSIDownloader={
		prefService:null,
		downloaderButton:null,
		anchors:null,
		prefPath:"msi.downloader.file.path",
		path:null,
		data:null,
		panel:null,
		jso:null,
		init:function() {
			//remove the window onload as it is not needed anymore
			window.removeEventListener("load",MSIDownloader.init,false);

			//get the string-bundle
			MSIDownloader.bundle=document.getElementById("downloader-string-bundle");

//			//load preferences
//			MSIDownloader.loadPreferences();

			//add page load listener to check new pages for anchors
			gBrowser.addEventListener("DOMContentLoaded",MSIDownloader.pageLoaded,false);

			//add tab listener to check for newly selected tab
			let container=gBrowser.tabContainer;
			container.addEventListener("TabSelect",MSIDownloader.tabSelected,false);
			
			//add tab listener to check for tab changes to detect tab that was deselected
			container.addEventListener("TabAttrModified",MSIDownloader.tabAttrModified,false);

			//set the preference service
			MSIDownloader.prefService=Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);

			//standard buttons on nav-bar
			//unified-back-forward-button" 
			//urlbar-container" 
			//reload-button" 
			//stop-button" 
			//search-container" 
			//webrtc-status-button" 
			//bookmarks-menu-button" 
			//downloads-button" 
			//home-button" 
			//window-controls" 
			//social-share-button"
			//downloader-button"
			//social-toolbar-item"
			
			//check if this is the first install and if so, then store that it was installed
			let prefInstallComplete="msi.downloader.install.complete";

			//if the button has not been installed before, then install it
			if(!MSIDownloader.prefService.prefHasUserValue(prefInstallComplete)) {
				let toolbar=document.getElementById("nav-bar");
				let buttonId="downloader-button";
				
				//try putting it right after before the downloads button
	            let before=document.getElementById("downloads-button");
	            if(!before) {
	            	//downloads button not found so try putting it after the search container
	            	before=document.getElementById("search-container");
	            	if(before) {
		            	//put it before the element after the search container
		            	before=before.nextElementSibling;
	            	} else {
	            		//if the search container was not found, put before the last element of the toolbar
	            		before=toolbar.lastChild;
	            	};
	            }
	            
				//add the button, and make it persist between runs
				toolbar.insertItem(buttonId,before);
				toolbar.setAttribute("currentset",toolbar.currentSet);
				document.persist(toolbar.id,"currentset");
			 
				//if the navigation toolbar is hidden, show it, so the user can see the button
				toolbar.collapsed=false;

				//store that we have installed the button at least once
				MSIDownloader.prefService.setBoolPref(prefInstallComplete,true);
			}
			//store the toolbar button reference for later use
			MSIDownloader.downloaderButton=document.getElementById("downloader-button");
			
			//check for anchors to enable/disable button for this tab
			MSIDownloader.checkForAnchors();
			
			//initialize button that downloads the selected files
			let btnDownload=document.getElementById("btnDownload");
			btnDownload.addEventListener("click",MSIDownloader.download,false);

			//initialize button that allows changing the path
			let btnChange=document.getElementById("btnChange");
			btnChange.addEventListener("click",MSIDownloader.changePath,false);
			
			//initialize button that allows restoring the default path
			let btnUseDefault=document.getElementById("btnUseDefault");
			btnUseDefault.addEventListener("click",MSIDownloader.useDefaultPath,false);

			//initialize select/unselect checkbox
			let chkAll=document.getElementById("chkAll");
			chkAll.addEventListener("click",MSIDownloader.selectUnselect,false);
			let chkNone=document.getElementById("chkNone");
			chkNone.addEventListener("click",MSIDownloader.selectUnselect,false);
			
			//setup listener from injected code
			MSIDownloader.listen_request(MSIDownloader.callback);
		},

		destroy:function() {
			//remove the page load and tab selected listeners
			let container=gBrowser.tabContainer;
			container.removeEventListener("TabSelect",MSIDownloader.tabSelected,false);
			container.removeEventListener("TabAttrModified",MSIDownloader.tabAttrModified,false);
			gBrowser.removeEventListener("DOMContentLoaded",MSIDownloader.pageLoaded,false);
		},
		
		loadPath:function() {
			//get previously used path, if any
			let filePath=document.getElementById("filePath");
			if(!MSIDownloader.prefService.prefHasUserValue(MSIDownloader.prefPath)) {
				//no path stored so just use downloads folder
				filePath.value=MSIDownloader.downloadPath();
			} else {
				//use previous path
				filePath.value=MSIDownloader.prefService.getCharPref(MSIDownloader.prefPath);
			}
			
			//enable/disable the Use Default button if the file path matches the current download path
			MSIDownloader.setUseDefaultButtonStatus();
		},
		
		downloadPath:function() {
			//get the download path from the preferences
			let path=Application.prefs.get("browser.download.dir");
			if(path) {
				return path.value;
			} else {
				//if not in preferences, use the default download folder for this type of system
				let directoryService=Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
				let downloadDir=directoryService.get("DfltDwnld",Components.interfaces.nsIFile);
				return downloadDir.path;
			}
		},
		
		showPopup:function() {
			MSIDownloader.anchors=window.content.document.querySelectorAll("a[href][download]");
			if(MSIDownloader.anchors.length>0) {
				//populate the list
				MSIDownloader.populateList();
				
				//load the download path
				MSIDownloader.loadPath();
				
				//open the popup panel
				MSIDownloader.panel=document.getElementById("downloader-panel");
				MSIDownloader.panel.openPopup(MSIDownloader.downloaderButton,"after_end",0,0,false,false);
			}
		},
		
		populateList:function() {
			let i,d,anchor,row,checkbox,label,href,download;
			let anchors=MSIDownloader.anchors;
			
			let grid=document.getElementById("list");
			let rows=grid.querySelector("rows");
			
			//remove rows if they exist
			if(rows) grid.removeChild(rows);
			
			//create new rows
			rows=document.createElement("rows");
			grid.appendChild(rows);
			
			//clear data array used to store download info for later
			MSIDownloader.data=[];
			
			//create table row for each file
			for(i=0;i<anchors.length;i++) {
				anchor=anchors[i];
				
				//new row
				row=document.createElement("row");
				row.setAttribute("class","color"+(i&1));
				row.setAttribute("align","center");
				rows.appendChild(row);
				
				//create checkbox
				checkbox=document.createElement("checkbox");
				checkbox.setAttribute("class","downloadItem");
				checkbox.setAttribute("checked","true");
				row.appendChild(checkbox);
				
				//process the data to use below, and during download process
				href=MSIDownloader.absolutePath(anchor.getAttribute("href"));
				download=MSIDownloader.fileName(anchor.getAttribute("download"));

				MSIDownloader.data.push({download:download,href:href});
				
				//create download name
				/*label=document.createElement("label");
				label.setAttribute("crop","end");
				label.setAttribute("value",MSIDownloader.fileName(anchor.getAttribute("download")));
				row.appendChild(label);*/

				//create download name
				label=document.createElement("label");
				label.setAttribute("crop","end");
				label.setAttribute("class","download");
				if (!anchor.textContent) {
					label.setAttribute("value",MSIDownloader.fileName(anchor.getAttribute("download")));
					row.appendChild(label);
				} else {
					label.setAttribute("value",MSIDownloader.fileName(anchor.textContent));
					row.appendChild(label);
				}
		
				
				//create href link 
				/*label=document.createElement("label");
				label.setAttribute("crop","end");
				label.setAttribute("class","text-link");
				label.setAttribute("value",MSIDownloader.absolutePath(anchor.getAttribute("href")));
				label.addEventListener("click",MSIDownloader.openInBrowser);
				row.appendChild(label);*/
				
				//create link description cell
				/*label=document.createElement("label");
				label.setAttribute("crop","end");
				//label.setAttribute("value",anchor.textContent);
				label.setAttribute("value"," ");
				label.setAttribute("class", "small_col");
				row.appendChild(label);*/
			}
		},
		
		checkForAnchors:function() {
			
			//get all anchors that have an href and a download tag
			anchors=window.content.document.querySelectorAll("a[href][download]");
			
			//enable the button if download anchors are found
			if(MSIDownloader.downloaderButton)
				MSIDownloader.downloaderButton.disabled=(anchors.length==0);
		},
		
		pageLoaded:function(event) {
			MSIDownloader.checkForAnchors();
			
			//inject the content script to listen for anchor changes
			MSIDownloader.injectJavascript();

		},
		
		tabSelected:function(event) {
			let href=window.content.document.location.href;
			
			MSIDownloader.checkForAnchors();
			//if content_script was already injected, this will just restart the observing
			MSIDownloader.injectJavascript();
		},
		
		tabAttrModified:function(event) {
			let tab=event.target;
			if(tab.selected==false) {
				let prevBrowser=gBrowser.getBrowserForTab(tab);
				let contentDoc=prevBrowser.contentDocument;

				let href=contentDoc.location.href;
				href=href.toLowerCase();
				
				let jso=contentDoc.defaultView.wrappedJSObject;
				if(jso.MSIDownloader)
					jso.MSIDownloader.stopObserving();

			};
		},
		
		selectUnselect:function() {
			let checked=this.id=="chkAll";
			let checkboxes=document.querySelectorAll("checkbox.downloadItem");
			let i;
			for(i=0;i<checkboxes.length;i++) {
				checkboxes[i].checked=checked;
			}
		},
		
		absolutePath:function(href) {
			let a=window.content.document.createElement("a");
			a.href=href;
			return a.href;
		},

		fileName:function(path) {
			let i=path.lastIndexOf("/");
			let j=path.lastIndexOf("\\");
			i=(i>j?i:j);
			return (i>-1?path.substr(i+1):path);
		},
		
		openInBrowser:function(path) {
			let href=path;
			let strWindowFeatures="toolbar=yes,menubar=yes,location=yes,resizable=yes,scrollbars=yes,status=yes";
			window.open(href,"DownloadLinkWindow",strWindowFeatures);
		},

		multipleDownload: function(data, path) {
			if (data) {
				let localFile;
				let i, d, fileName, tempName, count, n, j;

				//check if path exists, and if not, then create the folder
				localFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);

				//initiates download path and adds the relative path
				localFile.initWithPath(MSIDownloader.downloadPath());
				localFile.appendRelativePath(path);

				path = localFile.path;

				if (!localFile.exists() || !localFile.isDirectory()) {
					//read and write permissions to owner and group, read-only for others.
					localFile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0774);
				} else {
					//go until files lenght
					for (i = 0; i < data.length; i++) {
						d = data[i];
						tempName = fileName = d.download;

						localFile.initWithPath(OS.Path.join(path, tempName));
						for (n = 1; localFile.exists() && !localFile.isDirectory(); n++) {
							//append a number and see if that file exists
							j = fileName.lastIndexOf(".");
							if (j > -1) {
								tempName = fileName.substring(0, j) + "_" + n + fileName.substring(j);
							} else {
								//filenames without an extension just append number to the end of the name
								tempName = fileName + "_" + n;
							}
							localFile.initWithPath(OS.Path.join(path, tempName));
						}
						//use the temp name as the file name (may not have changed)
						d.download = tempName;
					}
				}

				//download the files
				Task.spawn(function() {
					let list = yield Downloads.getList(Downloads.ALL);

					let view = {
						onDownloadAdded: download => undefined, 
						onDownloadChanged: download => undefined, 
						onDownloadRemoved: download => undefined 
					};

					yield list.addView(view);
					try {
						for (i = 0; i < data.length; i++) {

							d = data[i];
							let download = yield Downloads.createDownload({
								source: d.href,
								target: OS.Path.join(path, d.download),
							});
							list.add(download);
							try {
								download.start();
							} catch (e) {

							}

						}
					} finally {
						yield list.removeView(view);
					}

				}).then(null, Components.utils.reportError);
			}
		},
	
		download:function() {
			let checkboxes=document.querySelectorAll("checkbox.downloadItem");
			let i,d,fileName,tempName,count,n,j;
			let filePath=document.getElementById("filePath");
			let path=filePath.value;
			let localFile;
			
			//check if path exists, and if not, then create the folder
			localFile=Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			localFile.initWithPath(path);
			if(!localFile.exists() || !localFile.isDirectory()) {
				//read and write permissions to owner and group, read-only for others.
				localFile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE,0774);
			} else {
				//folder existed already so check for duplicate filenames and rename any that are found
				for(i=0;i<checkboxes.length;i++) {
					if(checkboxes[i].checked) {
						//check this file name
						d=MSIDownloader.data[i];
						tempName=fileName=d.download;
						
						localFile.initWithPath(OS.Path.join(path,tempName));
						for(n=1;localFile.exists() && !localFile.isDirectory();n++) {
							//append a number and see if that file exists
							j=fileName.lastIndexOf(".");
							if(j>-1) {
								tempName=fileName.substring(0,j)+"_"+n+fileName.substring(j);
							} else {
								//filenames without an extension just append number to the end of the name
								tempName=fileName+"_"+n;
							}
							localFile.initWithPath(OS.Path.join(path,tempName));
						}
						//use the temp name as the file name (may not have changed)
						d.download=tempName;
					}
				}
			}

			
			//count total files to be downloaded
			for(i=count=0;i<checkboxes.length;i++) {
				if(checkboxes[i].checked) count++;
			}
			
			//download the files
			Task.spawn(function () {
				let list=yield Downloads.getList(Downloads.ALL);

				let view={
						onDownloadAdded: download => undefined, 
						onDownloadChanged: download => undefined, 
						onDownloadRemoved: download => undefined 
				};

				yield list.addView(view);
				try {
					for(i=0;i<checkboxes.length;i++) {
						if(checkboxes[i].checked) {

							d=MSIDownloader.data[i];

							let download = yield Downloads.createDownload({
								source: d.href,
								target: OS.Path.join(path,d.download),
							});
							list.add(download);
							try {
								download.start();
							} catch(e) {
								
							}
						}
					}
				} finally {
					yield list.removeView(view);
				}

			}).then(null, Components.utils.reportError);
			
			//close the popup
			MSIDownloader.panel.hidePopup();
		},

		changePath:function() {
			let filePath=document.getElementById("filePath");

			//allow user to choose download folder
			let file=Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			//convert the folder path to a file object
			try {
				file.initWithPath(filePath.value);
			} catch(error) {
				//if the previous download folder path is not valid just use the current download folder (this will likely never occur)
				file=initWithPath(MSIDownloader.downloadPath());
			}

			//initialize the file picker
			let fp=Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
			if(file) {
				//set the default directory to the current saved directory
				fp.displayDirectory=file;
			}

			//choose the download folder
			fp.init(window,MSIDownloader.bundle.getString("downloader-button.choose.title"),fp.modeGetFolder);

			if(fp.show()==fp.returnOK) {
				//folder was chosen (not cancelled), so update preferences and textbox
				filePath.value=fp.file.path;
				MSIDownloader.prefService.setCharPref(MSIDownloader.prefPath,filePath.value);
				MSIDownloader.setUseDefaultButtonStatus();
			}

			//allow the popup panel to autohide
			MSIDownloader.showPopup();

		},
		
		useDefaultPath:function() {
			let filePath=document.getElementById("filePath");

			//use default downloads folder
			filePath.value=MSIDownloader.downloadPath();
			
			//disable the use default button
			document.getElementById("btnUseDefault").disabled=true;
			
			//clear the preference for the previous custom download folder
			MSIDownloader.prefService.clearUserPref(MSIDownloader.prefPath);
		},
		
		setUseDefaultButtonStatus:function() {
			let filePath=document.getElementById("filePath");
			//use default downloads folder
			document.getElementById("btnUseDefault").disabled=(filePath.value==MSIDownloader.downloadPath());
		},

		injectJavascript:function() {
			let jso=window.content.document.defaultView.wrappedJSObject;
			MSIDownloader.jso=jso;
			if(!jso.MSIDownloader) {
//				MSIDownloader is not defined so inject javascript
				let script=top.window.content.document.createElement("script");
				script.type="text/javascript";
				script.setAttribute("src","chrome://downloader/content/content_script.js");
				if(top.window.content.document.getElementsByTagName("head")[0])
					top.window.content.document.getElementsByTagName("head")[0].appendChild(script);
				setTimeout(function() {MSIDownloader.waitForInjection(jso,1);},100);
			} else {
//				already injected so set mode immediately
				jso.MSIDownloader.init();
			}
		},

		waitForInjection:function(jso,count) {
			if(count>10) return;
			if(!jso.MSIDownloader) {

				setTimeout(function() {MSIDownloader.waitForInjection(jso,count+1);},100);
			} else {
				jso.MSIDownloader.init();
			}
		},
		
		listen_request:function(callback) { // analogue of chrome.extension.onRequest.addListener
			document.addEventListener("MSIDownloader-query",function(event) {
				var node=event.target;
				if(!node||node.nodeType!=Node.TEXT_NODE) return;

				var doc=node.ownerDocument;
				callback(JSON.parse(node.nodeValue),doc,function(response) {
					node.nodeValue=JSON.stringify(response);

					var event=doc.createEvent("HTMLEvents");
					event.initEvent("MSIDownloader-response",true,false);
					return node.dispatchEvent(event);
				});
			},false,true);
		},
		
		callback:function(request,sender,callback) {
			if(request.enableDownloader!=null) {
				if(MSIDownloader.downloaderButton)
					MSIDownloader.downloaderButton.disabled=!request.enableDownloader;
			}else if (request.initiateMultileDownload){
				MSIDownloader.multipleDownload(request.selected, request.path);
			}


			return callback(null);
		}
};

//overlay events
window.addEventListener("load",MSIDownloader.init,false);
window.addEventListener("unload",MSIDownloader.destroy,false);
