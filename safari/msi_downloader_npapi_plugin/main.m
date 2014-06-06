#import <WebKit/npapi.h>
#import <WebKit/npfunctions.h>
#import <WebKit/npruntime.h>
#import <QTKit/QTKit.h>
#import "downloadNPObject.h"

// Browser function table
NPNetscapeFuncs* browser;

// Structure for per-instance storage
typedef struct PluginObject
{
    NPP npp; //instance
    
    NPWindow window;
    
    // The NPObject for this scriptable object.
    NPObject *downloadNPObject;
} PluginObject;

NPError NPP_New(NPMIMEType pluginType, NPP instance, uint16_t mode, int16_t argc, char* argn[], char* argv[], NPSavedData* saved);
NPError NPP_Destroy(NPP instance, NPSavedData** save);
NPError NPP_SetWindow(NPP instance, NPWindow* window);
NPError NPP_NewStream(NPP instance, NPMIMEType type, NPStream* stream, NPBool seekable, uint16* stype);
NPError NPP_DestroyStream(NPP instance, NPStream* stream, NPReason reason);
int32_t NPP_WriteReady(NPP instance, NPStream* stream);
int32_t NPP_Write(NPP instance, NPStream* stream, int32_t offset, int32_t len, void* buffer);
void NPP_StreamAsFile(NPP instance, NPStream* stream, const char* fname);
void NPP_Print(NPP instance, NPPrint* platformPrint);
int16_t NPP_HandleEvent(NPP instance, void* event);
void NPP_URLNotify(NPP instance, const char* URL, NPReason reason, void* notifyData);
NPError NPP_GetValue(NPP instance, NPPVariable variable, void *value);
NPError NPP_SetValue(NPP instance, NPNVariable variable, void *value);

#pragma export on
// Mach-o entry points
NPError NP_Initialize(NPNetscapeFuncs *browserFuncs);
NPError NP_GetEntryPoints(NPPluginFuncs *pluginFuncs);
void NP_Shutdown(void);
#pragma export off

NPError NP_Initialize(NPNetscapeFuncs* browserFuncs)
{
    browser = browserFuncs;
    return NPERR_NO_ERROR;
}

NPError NP_GetEntryPoints(NPPluginFuncs* pluginFuncs)
{
    pluginFuncs->version = 11;
    pluginFuncs->size = sizeof(pluginFuncs);
    pluginFuncs->newp = NPP_New;
    pluginFuncs->destroy = NPP_Destroy;
    pluginFuncs->setwindow = NPP_SetWindow;
    pluginFuncs->newstream = NPP_NewStream;
    pluginFuncs->destroystream = NPP_DestroyStream;
    pluginFuncs->asfile = NPP_StreamAsFile;
    pluginFuncs->writeready = NPP_WriteReady;
    pluginFuncs->write = (NPP_WriteProcPtr)NPP_Write;
    pluginFuncs->print = NPP_Print;
    pluginFuncs->event = NPP_HandleEvent;
    pluginFuncs->urlnotify = NPP_URLNotify;
    pluginFuncs->getvalue = NPP_GetValue;
    pluginFuncs->setvalue = NPP_SetValue;
    
    return NPERR_NO_ERROR;
}

void NP_Shutdown(void)
{

}

NPError NPP_New(NPMIMEType pluginType, NPP instance, uint16_t mode, int16_t argc, char* argn[], char* argv[], NPSavedData* saved)
{
    // Create per-instance storage
    PluginObject *obj = (PluginObject *)browser->memalloc(sizeof(PluginObject));
    bzero(obj, sizeof(PluginObject));
    
    obj->npp = instance;
    instance->pdata = obj;

    return NPERR_NO_ERROR;
}

NPError NPP_Destroy(NPP instance, NPSavedData** save)
{
    PluginObject *obj = instance->pdata;

    // Release the movie NPObject so we won't leak it.
    if (obj->downloadNPObject)
        browser->releaseobject(obj->downloadNPObject);

    browser->memfree(obj);
    
    return NPERR_NO_ERROR;
}

NPError NPP_SetWindow(NPP instance, NPWindow* window)
{
    PluginObject *obj = instance->pdata;
    obj->window = *window;

    return NPERR_NO_ERROR;
}
 

NPError NPP_NewStream(NPP instance, NPMIMEType type, NPStream* stream, NPBool seekable, uint16* stype)
{
    *stype = NP_ASFILEONLY;
    return NPERR_NO_ERROR;
}

NPError NPP_DestroyStream(NPP instance, NPStream* stream, NPReason reason)
{
    return NPERR_NO_ERROR;
}

int32_t NPP_WriteReady(NPP instance, NPStream* stream)
{
    return 0;
}

int32_t NPP_Write(NPP instance, NPStream* stream, int32_t offset, int32_t len, void* buffer)
{
    return 0;
}

void NPP_StreamAsFile(NPP instance, NPStream* stream, const char* fname)
{
    //get the objects associated with the download
    PluginObject *obj = instance->pdata;
    DownloadNPObject *downloadNPObject=(DownloadNPObject *)obj->downloadNPObject;
    
    if(downloadNPObject!=NULL) {
        //if not downloading a file then skip this notice
        if(downloadNPObject->status!=1) return;
        
        //check to see if the browser is sending a temp file name from a download
        //if an error occurs while retrieving the data or writing the file, the file name (fname) is null.
        if(fname!=NULL) {
            
            //get the path to the temp file created by the browser for this download
            NSString *source=[NSString stringWithUTF8String:fname];
            
            //calculate the destination path to save the file to based on the base directory and the filename
            NSString *basePath=[NSString stringWithUTF8String:downloadNPObject->baseDir];
            NSString *fileName=[NSString stringWithUTF8String:downloadNPObject->fileName];
            NSString *destination=[basePath stringByAppendingPathComponent:fileName];
            
            //get a reference to the default file manager
            NSFileManager *fileManager = [NSFileManager defaultManager];
            
            //rename the destination file by appending a number if the destination file already exists
            NSString *tempName;
            NSUInteger j=[fileName rangeOfString:@"." options:NSBackwardsSearch].location;
            for(int n=1;[fileManager fileExistsAtPath:destination];n++) {
                //append a number and see if that file exists
                if(j!=NSNotFound) {
                    tempName=[fileName substringToIndex:j];
                    tempName=[tempName stringByAppendingString:@"_"];
                    tempName=[tempName stringByAppendingString:[NSString stringWithFormat: @"%d", n]];
                    tempName=[tempName stringByAppendingString:[fileName substringFromIndex:j]];
                } else {
                    //filenames without an extension just append number to the end of the name
                    tempName=fileName;
                    tempName=[tempName stringByAppendingString:@"_"];
                    tempName=[tempName stringByAppendingString:[NSString stringWithFormat: @"%d", n]];
                }
                destination=[basePath stringByAppendingPathComponent:tempName];
            }
            
            //copy from the temp file to the destination file
            if([[NSFileManager defaultManager] isReadableFileAtPath:source])
                [[NSFileManager defaultManager] copyItemAtPath:source toPath:destination error:nil];
        }
    }
}

void NPP_URLNotify(NPP instance, const char* url, NPReason reason, void* notifyData)
{
    //get the objects associated with the download
    PluginObject *obj = instance->pdata;
    DownloadNPObject *downloadNPObject=(DownloadNPObject *)obj->downloadNPObject;
    
    //free the memory used to hold the baseDir and fileName
    browser->memfree((void *)downloadNPObject->baseDir);
    browser->memfree((void *)downloadNPObject->fileName);
    
    //reset the download status
    downloadNPObject->status=0;
}

void NPP_Print(NPP instance, NPPrint* platformPrint)
{

}

int16_t NPP_HandleEvent(NPP instance, void* event)
{
    NPCocoaEvent *cocoaEvent = event;
    
    switch (cocoaEvent->type) {
            
        default:
            return 0;
    }
    
    return 0;
}

NPError NPP_GetValue(NPP instance, NPPVariable variable, void *value)
{
    PluginObject *obj = instance->pdata;

    switch (variable) {
        case NPPVpluginScriptableNPObject:
            // Create the download NPObject if necessary.
            if (!obj->downloadNPObject)
                obj->downloadNPObject = createDownloadNPObject(instance);

            // The NPAPI standard specifies that a retained NPObject should be returned.
            *(NPObject **)value = obj->downloadNPObject;
            browser->retainobject(obj->downloadNPObject);

            return NPERR_NO_ERROR;

        default:
            return NPERR_GENERIC_ERROR;
    }
}

NPError NPP_SetValue(NPP instance, NPNVariable variable, void *value)
{
    return NPERR_GENERIC_ERROR;
}
