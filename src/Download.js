import {getFocusedWebContents} from "./util";

const {BrowserWindow, webContents,dialog,ipcMain,app,shell} = require('electron')
const _webContents = webContents
import mainState from './mainState'
const Aria2cWrapper = require('./Aria2cWrapper')
const FfmpegWrapper = require('./FfmpegWrapper')
const {redirectUrlsCache} = require('../brave/adBlock')
const sanitizeFilename = require('./sanitizeFilename')

const path = require('path')
import {download,downloader} from './databaseFork'
import PubSub from './render/pubsub'
import fs from 'fs'
import uuid from 'node-uuid'
const URL = require('url')
const downloadPath = 'chrome-extension://dckpbojndfoinamcdamhkjhnjnmjkfjd/download.html'
const downloadPath2 = 'chrome-extension://dckpbojndfoinamcdamhkjhnjnmjkfjd/download_sidebar.html'
const timeMap = new Map()
global.downloadItems = []
const retry = new Map()


function exec(command) {
  console.log(command)
  return new Promise(function(resolve, reject) {
    require('child_process').exec(command, function(error, stdout, stderr) {
      if (error) {
        return reject(error);
      }
      resolve({stdout, stderr});
    });
  });
}

function shellEscape(s){
  return '"'+s.replace(/(["\t\n\r\f'$`\\])/g,'\\$1')+'"'
}

function set(map,url,value){
  if(map[url] === void 0){
    map[url] = [value]
  }
  else{
    map[url].push(value)
  }
}

function replaceFileName(savePath,url,fname){
  if(!savePath) return savePath

  const urlParse = path.parse(url), fnameParse = path.parse(fname)
  const date = new Date()
  const name = fnameParse.name,
    ext = fnameParse.ext.slice(1),
    base = urlParse.name,
    sub = urlParse.dir.split("/").slice(-1)[0],
    host = urlParse.dir.split("/")[2],
    y = date.getFullYear(),
    m = ('0' + (date.getMonth() + 1)).slice(-2),
    d = ('0' + date.getDate()).slice(-2),
    hh = ('0' + date.getHours()).slice(-2),
    mm = ('0' + date.getMinutes()).slice(-2),
    ss = ('0' + date.getSeconds()).slice(-2)

  return savePath.replace(/({.+?})/g,p=>{
    if(p == '{name}') return name
    else if(p == '{ext}') return ext
    else if(p == '{base}') return base
    else if(p == '{sub}') return host == sub ? "" : sub
    else if(p == '{host}') return host
    else if(p == '{y}') return y
    else if(p == '{m}') return m
    else if(p == '{d}') return d
    else if(p == '{hh}') return hh
    else if(p == '{mm}') return mm
    else if(p == '{ss}') return ss
    return p
  })
}

export default class Download {
  getData(map,url){
    if(map[url] === void 0){
      const rUrl = redirectUrlsCache.get(url)
      if(rUrl){
        return this.getData(map,rUrl)
      }
    }
    else{
      const shifted = map[url].shift()
      if(!map[url].length) delete map[url]
      if(shifted !== void 0) this.orgUrl = url
      return shifted
    }
  }

  constructor(win){
    this.needSavePath = {}
    this.noNeedSavePath = {}
    this.savePath = {}
    this.dlKey = {}
    this.saveDirectory = {}
    this.audioExtract = {}
    this.videoConvert = {}
    this.overwrite = {}
    this.prompt = {}
    this.savePageAs = {}

    ipcMain.on('set-save-path',(e,url,fname,absolute)=>{
      set(this.savePath,url,absolute ? fname : path.join(app.getPath('downloads'), sanitizeFilename(fname,{replacement:'_'})))
    })

    ipcMain.on('set-download-key',(e,url,key)=>{
      set(this.dlKey,url,key)
    })

    ipcMain.on('set-save-directory',(e,url,directory)=>{
      set(this.saveDirectory,url,directory)
    })

    ipcMain.on('set-audio-extract',(e,url)=>{
      set(this.audioExtract,url,true)
    })

    ipcMain.on('set-video-convert',(e,url,operation)=>{
      set(this.videoConvert,url,operation)
    })

    ipcMain.on('noneed-set-save-filename',(e,url)=>{
      set(this.noNeedSavePath,url,true)
    })

    ipcMain.on('need-set-save-filename',(e,url)=>{
      set(this.needSavePath,url,true)
    })

    ipcMain.on('save-page-as',(e,url)=>{
      set(this.savePageAs,url,true)
    })

    ipcMain.on('set-conflictAction',(e,url,type)=>{
      if(type == "overwrite") set(this.overwrite,url,true)
      else if(type == "prompt") set(this.prompt,url,true)
    })

    // ipcMain.on('need-set-save-filename',eventSetSaveFilename)

    const ses = win.webContents.session
    ses.on('will-download', (event, item, webContents) => {
      console.log("will-download0")
      if (!webContents || webContents.isDestroyed()) {
        event.preventDefault()
        return
      }

      const bw = (!webContents.isDestroyed() && BrowserWindow.fromWebContents(webContents)) || BrowserWindow.getFocusedWindow()
      console.log("will-download",bw === win)
      if(bw !== win) return


      let downloadId = item.getGuid()
      // let initialNav = false
      // const controller = webContents.controller()
      // if (controller && controller.isValid() && controller.isInitialNavigation()) {
      //   console.log('webContents.forceClose()',webContents.getURL())
      //   webContents.forceClose()
      //   initialNav = true
      // }

      console.log(item)

      // item.setSavePath(path.join(app.getPath('temp'),Math.random().toString()))
      // item.pause()
      // item.setPrompt(false)

      let active = true,
        url,fname,mimeType
      try{
        url = item.getURL()
        this.orgUrl = url
        mimeType = item.getMimeType()
        fname = item.getFilename()
      }catch(e){
        console.log(e)
        return
      }

      const cont = _webContents.getFocusedWebContents()
      let focusedWebContent
      if(cont && !cont.isDestroyed()) focusedWebContent = cont.session.partition || ""
      const cond = focusedWebContent == void 0 ? true : focusedWebContent != 'persist:tor' && !focusedWebContent.match(/^[\d\.]+$/)
      if(cond && !(retry.has(url) || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('chrome-extension:'))){
        console.log('cancel')
        item.destroy()
        // const _item = item
        // setTimeout(_=>{if(!_item.isDestroyed())_item.cancel(),1000})
        active = false
      }

      let savePath = this.getData(this.savePath,url),
        audioExtract = this.getData(this.audioExtract,url),
        videoConvert = this.getData(this.videoConvert,url),
      overwrite = false

      console.log(1,savePath)
      if(url.startsWith("file://")){
        if(active){
          item.destroy()
        }
        console.log(2)
        return
      }


      savePath = replaceFileName(savePath,url,fname)

      console.log(3,savePath)
      if(!win.webContents.isDestroyed()) win.webContents.send(`download-start-tab_${webContents.getId()}`)

      const needSavePath = this.getData(this.needSavePath,url)
      console.log('down2',url)
      const noNeedSavePath = this.getData(this.noNeedSavePath,url)

      const saveDirectory = this.getData(this.saveDirectory,url)
      let autoSetSavePath
      console.log(4)
      if(!savePath){
        autoSetSavePath = true
        savePath = path.join(saveDirectory || app.getPath('downloads'), fname || path.basename(url))
        console.log(5,savePath)
      }

      if((mainState.askDownload && !noNeedSavePath) || needSavePath || (this.getData(this.prompt,url) && fs.existsSync(savePath))){
        console.log("needSavePath")
        const isSavePageAs = this.getData(this.savePageAs,url)
        const opt = isSavePageAs ? {defaultPath: savePath,type: 'select-saveas-file', extensions: [['html'],['mht']], includeAllFiles:false } :
          {defaultPath: savePath,type: 'select-saveas-file',includeAllFiles:true }
        dialog.showDialog(win,opt,filepaths=>{
          if(!filepaths || filepaths.length > 1){
            if(active) item.destroy()
            return
          }

          console.log(6)
          savePath = filepaths[0]
          if(savePath.endsWith(".mht") || savePath.endsWith(".mhtml")){
            console.log(43432,savePath,cont.getURL())
            cont.savePage(savePath, 'MHTML', (error) => {
              const buildedItem = { key: uuid.v4(),
                isPaused: false,
                canResume: false,
                url,
                filename: path.basename(savePath),
                receivedBytes: 0,
                totalBytes: 0,
                state: 'completed',
                speed: void 0,
                savePath,
                startTime: Date.now(),
                now: Date.now() }
                for (let wc of this.getDownloadPage()) {
                  wc.send('download-progress', buildedItem)
                }
                if(!win.webContents.isDestroyed()) win.webContents.send('download-progress', buildedItem)
            })
            return
          }

          overwrite = true
          this.process(url, overwrite, savePath, item, webContents, win, mimeType, audioExtract, videoConvert, cond, downloadId);
        })
        return
      }
      else if(autoSetSavePath){
        if(url.endsWith(".pdf") || url.endsWith(".PDF") ){
          if(active){
            item.destroy()
          }
          return
        }
        console.log(7)
      }

      this.process(url, overwrite, savePath, item, webContents, win, mimeType, audioExtract, videoConvert, cond, downloadId);
    })
  }

  process(url, overwrite, savePath, item, webContents, win, mimeType, audioExtract, videoConvert, cond, downloadId) {
    console.log('downloadId1',downloadId)
    if (!cond || retry.has(url) || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('chrome-extension:')) {
      item.setPrompt(false)
      console.log('retry')
      downloadId = retry.get(url)
      console.log('downloadId2',downloadId)
      retry.delete(url)
      if (!this.getData(this.overwrite, url)) {
        savePath = this.getUniqFileName(savePath)
      }
      item.setSavePath(savePath)
      timeMap.set(savePath, Date.now())
      item.key = downloadId
      this.downloadReady(item, url, webContents, win, void 0, void 0)
    }
    else {
      console.log(8, savePath)
      // console.log(JSON.stringify({a: mainState.downloadNum}))
      // const postData = process.downloadParams.get(url)
      // // console.log(postData,url)
      // if(postData && (Date.now() - postData[1] < 100 * 1000)){
      //   process.downloadParams.delete(url)
      //   this.downloadReady(item, url, webContents,win)
      //   return
      // }
      let id, updated, ended, isError

      const aria2cKey = this.getData(this.dlKey, url)
      if(aria2cKey) downloadId = aria2cKey
      const dl = new Aria2cWrapper({
        url,
        orgUrl: this.orgUrl,
        mimeType,
        savePath,
        downloadNum: mainState.downloadNum,
        overwrite,
        timeMap,
        aria2cKey,
        downloadId
      })

      console.log(9)
      dl.download().then(_ => {
        console.log(10)
        dl.once('error', (_) => {
          console.log('error')
          if (!win.webContents.isDestroyed()) win.webContents.send('download-progress', this.buildItem(dl));
          if (!isError) {
            isError = true
            retry.set(url,downloadId)
            global.downloadItems = global.downloadItems.filter(i => i !== dl)
            set(this.savePath, url, savePath)
            set(this.audioExtract, url, audioExtract)
            set(this.videoConvert, url, videoConvert)
            if (overwrite) set(this.overwrite, url, true)
            webContents.downloadURL(url, true)
          }
          else{
            global.downloadItems = global.downloadItems.filter(i => i !== dl)
          }
        })
        this.downloadReady(dl, url, webContents, win, audioExtract, videoConvert)
      })

    }
    return savePath;
  }

  downloadReady(item, url, webContents,win,audioExtract,videoConvert) {
    global.downloadItems.push(item)
    console.log('downloadId3',item.key)

    console.log(11)
    const eventPause = (event, data, type) => {
      console.log('resume',data,item)
      if (data.id ? data.id !== item.idForExtension : data.key ? data.key !== item.key : data.savePath !== item.getSavePath()) return
      if(type == 'resume'){
        item.resume()
      }
      else if(type == 'pause'){
        item.pause()
      }
      else if (item.isPaused())
        item.resume()
      else
        item.pause()
    }
    ipcMain.on('download-pause', eventPause)

    const eventCancel = (event, data) => {
      console.log('eventCancel')
      if (data.id ? data.id !== item.idForExtension : data.key ? data.key !== item.key : data.savePath !== item.getSavePath()) return
      item.cancel()
      ipcMain.removeListener('download-pause', eventPause)
      ipcMain.removeListener('download-cancel', eventCancel)
      global.downloadItems = global.downloadItems.filter(i => i !== item)
      // timeMap.delete(item.getSavePath())
    }
    ipcMain.on('download-cancel', eventCancel)

    item.on('updated', (event, state) => {
      const buildedItem = this.buildItem(item)

      if(buildedItem.state == 'interrupted'){
        buildedItem.state = 'cancelled'
        global.downloadItems = global.downloadItems.filter(i => i !== item)
      }

      for (let wc of this.getDownloadPage()) {
        wc.send('download-progress', buildedItem)
      }
      if(!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('download-progress', buildedItem)
    })


    item.once('error', (_) => {
      console.log('errorfff')
      const buildedItem = this.buildItem(item)
      for (let wc of this.getDownloadPage()) {
        wc.send('download-progress', buildedItem)
      }
      if(!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('download-progress', buildedItem)
      global.downloadItems = global.downloadItems.filter(i => i !== item)
    })

    item.once('done', async (event, state) => {
      console.log(111,audioExtract,videoConvert)
      if(audioExtract){
        new FfmpegWrapper(item.getSavePath()).exe(_=>_)
      }
      if(videoConvert){
        getFocusedWebContents().then(cont=>{
          console.log(cont.getId(),cont.getURL())
          cont.hostWebContents.send('new-tab',cont.getId(),
            `chrome-extension://dckpbojndfoinamcdamhkjhnjnmjkfjd/converter.html?data=${encodeURIComponent(JSON.stringify({path:item.getSavePath(),info:videoConvert}))}`,
            void 0, void 0, void 0, true)
        })
      }
      const buildedItem = this.buildItem(item)
      for (let wc of this.getDownloadPage()) {
        wc.send('download-progress', buildedItem)
      }
      if(!win.webContents.isDestroyed()) win.webContents.send('download-progress', buildedItem)
      console.log(7887,buildedItem)

      download.insert({
        state: item.getState(),
        savePath: item.getSavePath(),
        filename: path.basename(item.getSavePath()),
        url: url,
        totalBytes: item.getTotalBytes(),
        now: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now()
      })

      ipcMain.removeListener('download-pause', eventPause)
      ipcMain.removeListener('download-cancel', eventCancel)
      global.downloadItems = global.downloadItems.filter(i => i !== item)
      timeMap.delete(item.getSavePath())
      // ipcMain.removeListener('set-save-filename',eventSetSaveFilename)
    })
    if(!win.webContents.isDestroyed()){
      win.webContents.send('download-start')
    }
    console.log(333434,!win.webContents.isDestroyed())
    console.log(333435,this.buildItem(item))

  }


  makePath(basePath,index){
    if(index === 0) return basePath
    const base = path.basename(basePath)
    const val = base.lastIndexOf('.')
    if(val == -1){
      return `${basePath} (${index})`
    }
    else{
      return path.join(path.dirname(basePath),`${base.slice(0,val)} (${index})${base.slice(val)}`)
    }
  }

  getUniqFileName(basePath,index=0){
    const savePath = this.makePath(basePath,index)
    return fs.existsSync(savePath) ? this.getUniqFileName(basePath,index+1) : savePath
  }

  buildItem(item) {
    return {
      key: item.key,
      isPaused: item.isPaused(),
      canResume: item.canResume(),
      url: item.getURL(),
      filename: path.basename(item.getSavePath()),
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      state: item.getState(),
      speed: item.speed ? item.speed.replace('i','') : void 0,
      savePath: item.getSavePath(),
      startTime: timeMap.get(item.getSavePath()),
      now: Date.now()
    };
  }

  getDownloadPage(){
    return webContents.getAllWebContents().filter(wc=>{
      const a = wc.getURL().replace(":///","://")
      return a === downloadPath.replace(/\\/g,'/').replace(":///","://") || a === downloadPath2.replace(/\\/g,'/').replace(":///","://")
    })
  }
}

downloader.find({isPaused:false,state:"progressing"}).then(records=>{
  for(let item of records){
    ipcMain.emit("download-retry", null, item.url, item.savePath, item.key)
  }
})