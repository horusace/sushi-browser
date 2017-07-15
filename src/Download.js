const {BrowserWindow, webContents,dialog,ipcMain,app,shell} = require('electron')
import mainState from './mainState'
const Downloader = require('./mt-files-downloader/lib/Downloader')
const downloader = new Downloader()

const path = require('path')
import {download} from './databaseFork'
import PubSub from './render/pubsub'
import fs from 'fs'
const URL = require('url')
const downloadPath = 'chrome-extension://dckpbojndfoinamcdamhkjhnjnmjkfjd/download.html'
const timeMap = new Map()
global.downloadItems = []
const retry = new Set()


export default class Download {
  constructor(win){
    const eventNeedSetSaveFilename = (event)=>{
      this.needSavePath = true
    }

    ipcMain.on('set-save-path',(e,fname)=>{
      this.savePath = path.join(app.getPath('downloads'), fname)
    })

    // ipcMain.on('need-set-save-filename',eventSetSaveFilename)
    PubSub.subscribe('need-set-save-filename',eventNeedSetSaveFilename)

    const ses = win.webContents.session
    ses.on('will-download', (event, item, webContents) => {
      let url = item.getURL()
      if(url.startsWith("file://")){
        event.preventDefault()
        return
      }

      const bw = BrowserWindow.fromWebContents(webContents) || BrowserWindow.getFocusedWindow()
      if(bw !== win) return

      win.webContents.send(`download-start-tab_${webContents.getId()}`)
      if(this.needSavePath){
        this.needSavePath = false
        const filepath = dialog.showSaveDialog(win,{defaultPath: path.join(app.getPath('downloads'), item.getFilename() || path.basename(url)) })
        if(!filepath){
          event.preventDefault()
          return
        }
        item.setSavePath(filepath)
      }
      else if(!this.savePath){
        if(url.endsWith(".pdf") || url.endsWith(".PDF") ){
          event.preventDefault()
          return
        }
        item.setSavePath(this.getUniqFileName(path.join(app.getPath('downloads'), item.getFilename() || path.basename(url))))
      }
      else {
        item.setSavePath(this.getUniqFileName(this.savePath))
        this.savePath = void 0
      }
      const savePath = item.getSavePath()
      timeMap.set(savePath, Date.now())
      if (retry.has(url)) {
        retry.delete(url)
      }
      else {
        console.log(JSON.stringify({a: mainState.downloadNum}))
        const postData = process.downloadParams.get(url)
        console.log(postData,url)
        if(postData && (Date.now() - postData[1] < 100 * 1000)){
          process.downloadParams.delete(url)
          this.downloadReady(item, url, webContents,win)
          return
        }
        else if(mainState.downloadNum == 0){
          this.downloadReady(item, url, webContents,win)
          return
        }
        event.preventDefault()
        let id, updated, ended, isError
        const dlUrl = URL.parse(url)
        const port = dlUrl.port

        const dl = downloader.download(url, savePath,{})
        dl.setOptions({count: mainState.downloadNum, port})
        dl.setRetryOptions({maxRetries: 1, retryInterval: 1500})

        dl.once('error', (dl) => {
          console.log(dl)
          if(!isError){
            isError = true
            retry.add(url)
            global.downloadItems = global.downloadItems.filter(i => i !== item)
            this.savePath = savePath
            webContents.downloadURL(url, true)
          }
        })
        item = {
          getURL(){
            return dl.url
          },
          getSavePath(){
            return dl.filePath
          },
          isPaused(){
            return dl.status == -2
          },
          resume(){
            dl.resume()
          },
          pause(){
            dl.stop()
          },
          cancel(){
            dl.destroy()
            ended()
            clearInterval(id)
          },
          canResume(){
            // return true
          },
          getState(){
            if (dl.status == -3 || dl.status == -1) {
              clearInterval(id)
              if(dl.status == -1 && !isError){
                isError = true
                retry.add(url)
                global.downloadItems = global.downloadItems.filter(i => i !== item)
                this.savePath = savePath
                webContents.downloadURL(url, true)
              }
              fs.unlink(`${dl.filePath}.mtd`,e=> {
                console.log(e)
              })
              if (isError) {
                return "progressing"
              }
              return "cancelled"
            }
            // else if(dl.status == -2){
            //   return "interrupted"
            // }
            else if (dl.status == 3) {
              return "completed"
              fs.unlink(`${dl.filePath}.mtd`,e=> {
                console.log(e)
              })
            }
            else {
              return "progressing"
            }
          },
          getReceivedBytes(){
            console.log(dl.status, dl.getStats())
            return dl.getStats().total.downloaded
          },
          getTotalBytes(){
            return dl.getStats().total.size
          },
          on(name, callback){
            if (name == 'updated') {
              updated = (dl) => callback()
              id = setInterval(updated, 1000)
            }
          },
          once(name, callback){
            if (name == 'done') {
              ended = (dl) => {
                callback()
                clearInterval(id)
              }
              dl.once('end', ended)
            }
          },
          dl
        }
      }
      this.downloadReady(item, url, webContents,win)
    })
  }

  downloadReady(item, url, webContents,win) {
    global.downloadItems.push(item)

    const eventPause = (event, data) => {
      if (data.savePath !== item.getSavePath())
      // return
        if (item.isPaused())
          item.resume()
        else
          item.pause()
    }
    ipcMain.on('download-pause', eventPause)

    const eventCancel = (event, data) => {
      if (data.savePath !== item.getSavePath())
        return
      timeMap.delete(item.getSavePath())
      item.cancel()
      ipcMain.removeListener('download-pause', eventPause)
      ipcMain.removeListener('download-cancel', eventCancel)
      global.downloadItems = global.downloadItems.filter(i => i !== item)
    }
    ipcMain.on('download-cancel', eventCancel)

    item.on('updated', (event, state) => {
      for (let wc of this.getDownloadPage()) {
        wc.send('download-progress', this.buildItem(item))
      }
      win.webContents.send('download-progress', this.buildItem(item))
    })

    item.once('done', (event, state) => {
      for (let wc of this.getDownloadPage()) {
        wc.send('download-progress', this.buildItem(item))
      }
      win.webContents.send('download-progress', this.buildItem(item))

      download.insert({
        state: item.getState(),
        savePath: item.getSavePath(),
        filename: path.basename(item.getSavePath()),
        url: url,
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
    win.webContents.send('download-start')
    if (item.dl) item.dl.start()
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
      isPaused: item.isPaused(),
      canResume: item.canResume(),
      url: item.getURL(),
      filename: path.basename(item.getSavePath()),
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      state: item.getState(),
      savePath: item.getSavePath(),
      startTime: timeMap.get(item.getSavePath()),
      now: Date.now()
    };
  }

  getDownloadPage(){
    return webContents.getAllWebContents().filter(wc=>wc.getURL().replace(":///","://") === downloadPath.replace(/\\/g,'/').replace(":///","://"))
  }
}