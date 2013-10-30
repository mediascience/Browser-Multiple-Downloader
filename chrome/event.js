/*
Copyright 2013 Media Science International

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

"use strict";
 
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("receive (in event): " + JSON.stringify(request, null, 4));
    if ( request.$type === "data" && request.downloads.length > 1) {
        console.log("count: " + request.downloads.length);
        chrome.pageAction.show(sender.tab.id);
        console.log("is a multi-download page");
        return sendResponse();
    } else {
        console.log("is not a multi-download page");
    }
});



chrome.pageAction.onClicked.addListener(function (tab) {
    var qry = {$type: "query"};
    console.log("sending query (from event): ", JSON.stringify(qry,null,4));
    chrome.tabs.sendMessage(tab.id, qry, function (response) {
        console.log("received data (in event): " + JSON.stringify(response,null,4));
        response.downloads.forEach(function (it) {
           console.log("schedule download: " +  it.filename);
           chrome.downloads.download({url: it.href, filename: it.filename});
        });
    });
});




