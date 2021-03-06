const {app,Menu,shell,ipcMain,BrowserWindow,session,webContents,clipboard} = require('electron')
const BrowserWindowPlus = require('./BrowserWindowPlus')
const seq = require('./sequence')
const locale = require('../brave/app/locale')
import mainState from './mainState'
import {getFocusedWebContents, getCurrentWindow} from './util'

const isDarwin = process.platform === 'darwin'
const topURL = mainState.newTabMode == 'myHomepage' ? mainState.myHomepage : `chrome-extension://dckpbojndfoinamcdamhkjhnjnmjkfjd/${mainState.newTabMode}.html`

const preferencesMenuItem = () => {
  return {
    label: locale.translation(isDarwin ? 'preferences' : 'settings'),
    accelerator: mainState.keySettings,
    click: (item, focusedWindow) => {
      getFocusedWebContents().then(cont=>{
        cont && cont.hostWebContents.send('new-tab',cont.getId(),'chrome-extension://dckpbojndfoinamcdamhkjhnjnmjkfjd/settings.html')
      })
    }
  }
}

const createFileSubmenu = () => {
  const submenu = [
    {
      label: locale.translation('newTab'),
      accelerator: mainState.keyNewTab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),"chrome://newtab/",void 0,!mainState.openTabNextLabel)
        })
      }
    },
    {
      label: locale.translation('newPrivateTab'),
      accelerator: mainState.keyNewPrivateTab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),"chrome://newtab/",true,!mainState.openTabNextLabel)
        })
      }
    },
    {
      label: 'New Tor Tab',
      accelerator: mainState.keyNewTorTab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),"chrome://newtab/",'persist:tor',!mainState.openTabNextLabel)
        })
      }
    },
    {
      label: locale.translation('newSessionTab'),
      accelerator: mainState.keyNewSessionTab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),"chrome://newtab/", `persist:${seq()}`,!mainState.openTabNextLabel)
        })
      }
    },
    {
      label: locale.translation('newWindow'),
      accelerator: mainState.keyNewWindow,
      click(item, focusedWindow) {
        BrowserWindowPlus.load({id:focusedWindow.id,sameSize:true})
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('openLocation'),
      accelerator: mainState.keyOpenLocation,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('focus-location-bar',cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('closeTab'),
      accelerator: mainState.keyCloseTab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events','closeTab',cont.getId())
        })
      }
    },
    {
      // This should be disabled when no windows are active.
      label: locale.translation('closeWindow'),
      accelerator: mainState.keyCloseWindow,
      click(item, focusedWindow) {
        focusedWindow.close()
      }
    },
    {
      label: locale.translation('closeAllTabsMenuLabel'),
      accelerator: mainState.keyClosePanel,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'closePanel', cont.getId())
        })
      }
    },
    {
      label: locale.translation('closeOtherTabs'),
      accelerator: mainState.keyCloseOtherTabs,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events','closeOtherTabs',cont.getId())
        })
      }
    },
    {
      label: locale.translation('closeTabsToLeft'),
      accelerator: mainState.keyCloseTabsToLeft,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events','closeTabsToLeft',cont.getId())
        })
      }
    },
    {
      label: locale.translation('closeTabsToRight'),
      accelerator: mainState.keyCloseTabsToRight,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events','closeTabsToRight',cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('savePageAs'),
      accelerator: mainState.keySavePageAs,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          if(cont){
            ipcMain.emit('need-set-save-filename',null,cont.getURL())
            cont.downloadURL(cont.getURL(), true)
          }
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('print'),
      accelerator: mainState.keyPrint,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.print()
        })
      }
    }
  ]

  if (!isDarwin) {
    submenu.push({ type: 'separator' })
    submenu.push({
      t: 'restartBrowser', label: locale.translation('restartBrowser'),
      accelerator: mainState.keyRestart,
      click() { ipcMain.emit('quit-browser',null,'restart') }
    })
    submenu.push({
      label: locale.translation('quitApp').replace('Brave','Sushi Browser'),
      accelerator: mainState.keyQuit,
      click() { ipcMain.emit('quit-browser') }
    })
  }

  return submenu
}


const createEditSubmenu = () => {
  const submenu = [
    {
      label: locale.translation('undo'),
      accelerator: mainState.keyUndo,
      role: 'undo'
    }, {
      label: locale.translation('redo'),
      accelerator: mainState.keyRedo,
      role: 'redo'
    },
    { type: 'separator' },
    {
      label: locale.translation('cut'),
      accelerator: mainState.keyCut,
      role: 'cut'
    }, {
      label: locale.translation('copy'),
      accelerator: mainState.keyCopy,
      role: 'copy'
    }, {
      label: locale.translation('paste'),
      accelerator: mainState.keyPaste,
      role: 'paste'
    }, {
      label: locale.translation('pasteWithoutFormatting'),
      accelerator: mainState.keyPasteWithoutFormatting,
      click(item, focusedWindow) {
        focusedWindow.webContents.pasteAndMatchStyle()
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('delete'),
      accelerator: 'Delete',
      click(item, focusedWindow) {
        focusedWindow.webContents.delete()
      }
    }, {
      label: locale.translation('selectAll'),
      accelerator: mainState.keySelectAll,
      role: 'selectall'
    },
    { type: 'separator' },

    {
      label: locale.translation('findOnPage'),
      accelerator: mainState.keyFindOnPage,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events','findOnPage',cont.getId())
        })
      }
    },
    {
      label: 'Toggle Find in Page',
      accelerator: mainState.keyToggleFindOnPage,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events','toggleFindOnPage',cont.getId())
        })
      }
    },
    {
      label: 'Find All',
      accelerator: mainState.keyFindAll,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events','findAll',cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('clicktabCopyTabUrl').replace('&apos;',"'"),
      accelerator: mainState.keyClicktabCopyTabUrl,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'clicktabCopyTabUrl', cont.getId())
        })
      }
    },
    {
      label: locale.translation('clicktabCopyUrlFromClipboard'),
      accelerator: mainState.keyClicktabCopyUrlFromClipboard,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'clicktabCopyUrlFromClipboard', cont.getId())
        })
      }
    },
    {
      label: locale.translation('pasteAndOpen'),
      accelerator: mainState.keyPasteAndOpen,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'pasteAndOpen', cont.getId())
        })
      }
    },
    {
      t: 'copyTabInfo', label: locale.translation('copyTabInfo'),
      accelerator: mainState.keyCopyTabInfo,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'copyTabInfo', cont.getId())
        })
      }
    },
    {
      t: 'copyAllTabTitles', label: locale.translation('copyAllTabTitles'),
      accelerator: mainState.keyCopyAllTabTitles,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'copyAllTabTitles', cont.getId())
        })
      }
    },
    {
      t: 'copyAllTabURLs', label: locale.translation('copyAllTabURLs'),
      accelerator: mainState.keyCopyAllTabUrls,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'copyAllTabUrls', cont.getId())
        })
      }
    },
    {
      t: 'copyAllTabInfos', label: locale.translation('copyAllTabInfos'),
      accelerator: mainState.keyCopyAllTabInfos,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'copyAllTabInfos', cont.getId())
        })
      }
    },
    // { type: 'separator' }
    // NOTE: macOS inserts "start dictation" and "emoji and symbols" automatically
  ]

  // console.log('mainState.rectSelection',mainState.rectSelection&&mainState.rectSelection[1])
  if(mainState.rectSelection){
    delete submenu[4].role
    submenu[4].click = function(item, focusedWindow) {
        getFocusedWebContents(true).then(cont=>{
          if(cont){
            if(cont.getId() == mainState.rectSelection[0].getId()){
              clipboard.writeText(mainState.rectSelection[1])
            }
            else{
              cont.copy()
            }
          }
        })
    }
  }

  if (isDarwin) {
    // delete submenu[4].role
    // submenu[4].click = function(item, focusedWindow) {
    //   getFocusedWebContents(true).then(cont=>{
    //     cont && cont.copy()
    //   })
    // }
  }
  else{
    submenu.push({ type: 'separator' })
    submenu.push(preferencesMenuItem())
  }


  return submenu
}

const createViewSubmenu = () => {
  return [
    {
      label: locale.translation('actualSize'),
      accelerator: mainState.keyActualSize,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.zoomReset()
        })
      }
    }, {
      label: locale.translation('zoomIn'),
      accelerator: mainState.keyZoomIn,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'zoomIn', cont.getId())
        })
      }
    }, {
      label: locale.translation('zoomOut'),
      accelerator: mainState.keyZoomOut,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'zoomOut', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('stop'),
      accelerator: mainState.keyStop,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.stop()
        })
      }
    },
    {
      label: locale.translation('reloadPage'),
      accelerator: mainState.keyReloadPage,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.reload()
        })
      }
    },
    {
      label: locale.translation('cleanReload'),
      accelerator: mainState.keyCleanReload,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.reloadIgnoringCache()
        })
      }
    },
    {
      label: locale.translation('clicktabReloadtabs'),
      accelerator: mainState.keyClicktabReloadtabs,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'clicktabReloadtabs', cont.getId())
        })
      }
    },
    {
      label: locale.translation('clicktabReloadothertabs'),
      accelerator: mainState.keyClicktabReloadothertabs,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'clicktabReloadothertabs', cont.getId())
        })
      }
    },
    {
      label: locale.translation('clicktabReloadlefttabs'),
      accelerator: mainState.keyClicktabReloadlefttabs,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'clicktabReloadlefttabs', cont.getId())
        })
      }
    },
    {
      label: locale.translation('clicktabReloadrighttabs'),
      accelerator: mainState.keyClicktabReloadrighttabs,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'clicktabReloadrighttabs', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('3007771295016901659'),
      accelerator: mainState.keyDuplicateTab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'duplicateTab', cont.getId())
        })
      }
    },
    {
      label: locale.translation('pinTab'),
      accelerator: mainState.keyUnpinTab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'unpinTab', cont.getId())
        })
      }
    },
    {
      label: locale.translation('muteTab'),
      accelerator: mainState.keyUnmuteTab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'unmuteTab', cont.getId())
        })
      }
    },    {
      label: locale.translation('freezeTabMenuLabel'),
      accelerator: mainState.keyFreezeTabMenuLabel,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'freezeTabMenuLabel', cont.getId())
        })
      }
    },
    {
      label: locale.translation('protectTabMenuLabel'),
      accelerator: mainState.keyProtectTabMenuLabel,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'protectTabMenuLabel', cont.getId())
        })
      }
    },
    {
      label: locale.translation('lockTabMenuLabel'),
      accelerator: mainState.keyLockTabMenuLabel,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'lockTabMenuLabel', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('toggleDeveloperTools'),
      accelerator: mainState.keyToggleDeveloperTools,
      click(item) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'toggleDeveloperTools', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('toggleFullScreenView'),
      accelerator: mainState.keyToggleFullScreenView,
      click(item, focusedWindow) {
        if (focusedWindow) {
          if(isDarwin){
            focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
          }
          else{
            const isFullScreen = focusedWindow.isFullScreen()
            focusedWindow.webContents.send('switch-fullscreen',!isFullScreen)
            focusedWindow.setFullScreenable(true)
            const menubar = focusedWindow.isMenuBarVisible()
            focusedWindow.setFullScreen(!isFullScreen)
            focusedWindow.setMenuBarVisibility(menubar)
            focusedWindow.setFullScreenable(false)
          }
        }
      }
    },
    { type: 'separator' },
    {
      t: 'fullPageCaptureToClipboard', label: locale.translation('fullPageCaptureToClipboard'),
      accelerator: mainState.keyScreenShotFullClipBoard,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'screenShotFullClipBoard', cont.getId())
        })
      }
    },
    {
      t: 'fullPageCaptureAsJPEG', label: locale.translation('fullPageCaptureAsJPEG'),
      accelerator: mainState.keyScreenShotFullJpeg,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'screenShotFullJpeg', cont.getId())
        })
      }
    },
    {
      t: 'fullPageCaptureAsPNG', label: locale.translation('fullPageCaptureAsPNG'),
      accelerator: mainState.keyScreenShotFullPng,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'screenShotFullPng', cont.getId())
        })
      }
    },
    {
      t: 'selectionCaptureToClipboard', label: locale.translation('selectionCaptureToClipboard'),
      accelerator: mainState.keyScreenShotSelectionClipBoard,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'screenShotSelectionClipBoard', cont.getId())
        })
      }
    },
    {
      t: 'selectionCaptureAsJPEG', label: locale.translation('selectionCaptureAsJPEG'),
      accelerator: mainState.keyScreenShotSelectionJpeg,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'screenShotSelectionJpeg', cont.getId())
        })
      }
    },
    {
      t: 'selectionCaptureAsPNG', label: locale.translation('selectionCaptureAsPNG'),
      accelerator: mainState.keyScreenShotSelectionPng,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'screenShotSelectionPng', cont.getId())
        })
      }
    },
  ]
}


const createHistorySubmenu = () => {
  let submenu = [
    {
      label: locale.translation('home'),
      accelerator: mainState.keyHome,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=> {
          cont && cont.hostWebContents.send('menu-or-key-events', 'navigatePage', cont.getId(), "chrome://newtab/")
        })
      }
    },
    {
      label: locale.translation('back'),
      accelerator: mainState.keyBack,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=> {
          cont && cont.hostWebContents.send('go-navigate', cont.getId(), 'back')
        })
      }
    },
    {
      label: locale.translation('forward'),
      accelerator: mainState.keyForward,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=> {
          cont && cont.hostWebContents.send('go-navigate', cont.getId(), 'forward')
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('reopenLastClosedTab'),
      accelerator: mainState.keyReopenLastClosedTab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'reopenLastClosedTab', cont.getId())
        })
      }
    },
    {
      label: locale.translation('clicktabUcatab'),
      accelerator: mainState.keyClicktabUcatab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'clicktabUcatab', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('showAllHistory'),
      accelerator: mainState.keyShowAllHistory,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),'chrome://history/')
        })
      }
    }
  ]

  return submenu
}

const createBookmarksSubmenu = () => {
  let submenu = [
    {
      label: locale.translation('bookmarkPage'),
      accelerator: mainState.keyBookmarkPage,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('add-favorite',cont.getId())
        })
      }
    },
    {
      label: locale.translation('5078638979202084724'),
      accelerator: mainState.keyAddBookmarkAll,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'addBookmarkAll', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('bookmarksManager'),
      accelerator: mainState.keyBookmarksManager,
      click: (item, focusedWindow) => {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),'chrome://bookmarks/')
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('importBrowserData'),
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          ipcMain.emit("import-browser-data",{sender: cont})
        })
      }
    },
    {
      label: locale.translation('exportBookmarks'),
      click(item, focusedWindow) {
        ipcMain.emit("export-bookmark")
      }
    }
  ]

  return submenu
}

const createWindowSubmenu = () => {
  const submenu = [
    {
      label: locale.translation('minimize'),
      accelerator: mainState.keyMinimize,
      role: 'minimize'
      // "Minimize all" added automatically
    },
    { type: 'separator' },
    {
      label: locale.translation('selectNextTab'),
      accelerator: mainState.keySelectNextTab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'selectNextTab', cont.getId())
        })
      }
    },
    {
      label: locale.translation('selectPreviousTab'),
      accelerator: mainState.keySelectPreviousTab,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'selectPreviousTab', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      label: locale.translation('multiRowTabs'),
      accelerator: mainState.keyMultiRowTabs,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'multiRowTabs', cont.getId())
        })
      }
    },
    {
      t: 'tabPreview', label: locale.translation('tabPreview'),
      accelerator: mainState.keyTabPreview,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'tabPreview', cont.getId())
        })
      }
    },
    {
      t: 'toggleMenuBar', label: locale.translation('toggleMenuBar'),
      accelerator: mainState.keyToggleMenuBar,
      click(item, focusedWindow) {
        if (focusedWindow) focusedWindow.webContents.send('toggle-nav')
      }
    },
    {
      t: 'changeFocusPanel', label: locale.translation('changeFocusPanel'),
      accelerator: mainState.keyChangeFocusPanel,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'changeFocusPanel', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      t: 'splitLeft', label: locale.translation('splitLeft'),
      accelerator: mainState.keySplitLeft,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'splitLeft', cont.getId())
        })
      }
    },
    {
      t: 'splitRight', label: locale.translation('splitRight'),
      accelerator: mainState.keySplitRight,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'splitRight', cont.getId())
        })
      }
    },
    {
      t: 'splitTop', label: locale.translation('splitTop'),
      accelerator: mainState.keySplitTop,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'splitTop', cont.getId())
        })
      }
    },
    {
      t: 'splitBottom', label: locale.translation('splitBottom'),
      accelerator: mainState.keySplitBottom,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'splitBottom', cont.getId())
        })
      }
    },
    {
      t: 'splitLeftTabsToLeft', label: locale.translation('splitLeftTabsToLeft'),
      accelerator: mainState.keySplitLeftTabs,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'splitLeftTabs', cont.getId())
        })
      }
    },
    {
      t: 'splitRightTabsToRight', label: locale.translation('splitRightTabsToRight'),
      accelerator: mainState.keySplitRightTabs,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'splitRightTabs', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      t: 'swapPosition', label: locale.translation('swapPosition'),
      accelerator: mainState.keySwapPosition,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'swapPosition', cont.getId())
        })
      }
    },
    {
      t: 'switchDirection', label: locale.translation('switchDirection'),
      accelerator: mainState.keySwitchDirection,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'switchDirection', cont.getId())
        })
      }
    },
    {
      t: 'alignHorizontal', label: locale.translation('alignHorizontal'),
      accelerator: mainState.keyAlignHorizontal,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'alignHorizontal', cont.getId())
        })
      }
    },
    {
      t: 'alignVertical', label: locale.translation('alignVertical'),
      accelerator: mainState.keyAlignVertical,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'alignVertical', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      label: 'Arrange All Panel',
      accelerator: mainState.keyArrangePanel,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'arrangePanel', cont.getId())
        })
      }
    },
    {
      label: 'Arrange Panel',
      accelerator: mainState.keyArrangePanelEach,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          console.log('arrangePanelEach')
          cont && cont.hostWebContents.send('menu-or-key-events', 'arrangePanelEach', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      t: 'switchSyncScroll', label: locale.translation('switchSyncScroll'),
      accelerator: mainState.keySwitchSyncScroll,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'switchSyncScroll', cont.getId())
        })
      }
    },
    {
      t: 'openSidebar', label: locale.translation('openSidebar'),
      accelerator: mainState.keyOpenSidebar,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'openSidebar', cont.getId())
        })
      }
    },
    {
      t: 'enableSearchHighlight', label: locale.translation('enableSearchHighlight'),
      accelerator: mainState.keySearchHighlight,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'searchHighlight', cont.getId())
        })
      }
    },
    {
      t: 'changeToMobileAgent', label: locale.translation('changeToMobileAgent'),
      accelerator: mainState.keyChangeMobileAgent,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'changeMobileAgent', cont.getId())
        })
      }
    },
    { type: 'separator' },
    {
      t: 'detachPanel', label: locale.translation('detachPanel'),
      accelerator: mainState.keyDetachPanel,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'detachPanel', cont.getId())
        })
      }
    },
    {
      t: 'floatingPanel', label: locale.translation('floatingPanel'),
      accelerator: mainState.keyFloatingPanel,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'floatingPanel', cont.getId())
        })
      }
    },
    {
      label: 'Maximize Panel',
      accelerator: mainState.keyMaximizePanel,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('menu-or-key-events', 'maximizePanel', cont.getId())
        })
      }
    },
    // {
    //   t: 'downloadAll', label: locale.translation('downloadAll'),
    //   accelerator: mainState.keyDownloadAll,
    //   click(item, focusedWindow) {
    //     getFocusedWebContents().then(cont=>{
    //       cont && cont.hostWebContents.send('menu-or-key-events', 'downloadAll', cont.getId())
    //     })
    //   }
    // },
    // {
    //   label: locale.translation('2473195200299095979'),
    //   accelerator: mainState.keyPageTranslate,
    //   click(item, focusedWindow) {
    //     getFocusedWebContents().then(cont=>{
    //       cont && cont.hostWebContents.send('menu-or-key-events', 'pageTranslate', cont.getId())
    //     })
    //   }
    // },
    { type: 'separator' },
    {
      label: locale.translation('downloadsManager'),
      accelerator: mainState.keyDownloadsManager,
      click(item, focusedWindow){
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),'chrome-extension://dckpbojndfoinamcdamhkjhnjnmjkfjd/download.html')
        })
      }
    },
    {
      t: 'openNote', label: locale.translation('openNote'),
      accelerator: mainState.keyNote,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),'chrome://note/')
        })
      }
    },
    {
      t: 'openFileExploler', label: locale.translation('openFileExploler'),
      accelerator: mainState.keyFileExploler,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),'chrome://explorer/')
        })
      }
    },
    {
      t: 'openTerminal', label: locale.translation('openTerminal'),
      accelerator: mainState.keyTerminal,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),'chrome://terminal/')
        })
      }
    },
    {
      t: 'openAutomation', label: locale.translation('openAutomation'),
      accelerator: mainState.keyAutomation,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),'chrome://automation/')
        })
      }
    },
    {
      t: 'openVideoConverter', label: locale.translation('openVideoConverter'),
      accelerator: mainState.keyVideoConverter,
      click(item, focusedWindow) {
        getFocusedWebContents().then(cont=>{
          cont && cont.hostWebContents.send('new-tab',cont.getId(),'chrome://converter/')
        })
      }
    }
  ]

  if (isDarwin) {
    submenu.push(
      { type: 'separator' },
      {
        label: locale.translation('bringAllToFront'),
        role: 'front'
      }
    )
  }

  return submenu
}


let appMenu
function getTemplate(){
  const template = [
    { label: locale.translation('file'), submenu: createFileSubmenu() },
    { label: locale.translation('edit'), submenu: createEditSubmenu() },
    { label: locale.translation('view'), submenu: createViewSubmenu() },
    { label: locale.translation('history'), submenu: createHistorySubmenu() },
    { label: locale.translation('bookmarks'), submenu: createBookmarksSubmenu() },
    { label: locale.translation('window'), submenu: createWindowSubmenu(), role: 'window' },
    // { label: locale.translation('help'), submenu: createHelpSubmenu(), role: 'help' }
  ]


  // const t = [
  //   {
  //     label: 'File',
  //     submenu: [
  //       { label: 'New &Window',
  //         accelerator: 'CmdOrCtrl+Alt+N',
  //         click: ()=>{BrowserWindowPlus.load()}
  //       },
  //       {
  //         label: 'Close',
  //         accelerator: 'CmdOrCtrl+W',
  //         role: 'close'
  //       }
  //     ]
  //   },
  //   {
  //     label: 'Edit',
  //     submenu: [
  //       {
  //         label: 'Undo',
  //         accelerator: 'CmdOrCtrl+Z',
  //         role: 'undo'
  //       },
  //       {
  //         label: 'Redo',
  //         accelerator: 'CmdOrCtrl+Y',
  //         role: 'redo'
  //       }
  //     ]
  //   },
  //   {
  //     label: 'View',
  //     submenu: [
  //       {
  //         label: `${locale.translation('toggleMenuBar')}`,
  //         accelerator: 'CmdOrCtrl+Alt+T',
  //         click(item, focusedWindow) {
  //           if (focusedWindow) focusedWindow.webContents.send('toggle-nav')
  //         }
  //       },
  //       {
  //         label: 'Toggle Full Screen',
  //         accelerator: (function () {
  //           if (process.platform === 'darwin') {
  //             return 'Ctrl+Command+F'
  //           } else {
  //             return 'F11'
  //           }
  //         })(),
  //         click(item, focusedWindow) {
  //           if (focusedWindow) {
  //             focusedWindow.setFullScreenable(true)
  //             const menubar = focusedWindow.isMenuBarVisible()
  //             focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
  //             focusedWindow.setMenuBarVisibility(menubar)
  //             focusedWindow.setFullScreenable(false)
  //           }
  //         }
  //       },
  //       {
  //         label: 'Toggle Developer Tools',
  //         accelerator: (function () {
  //           if (process.platform === 'darwin') {
  //             return 'Alt+Command+I'
  //           } else {
  //             return 'Ctrl+Shift+I'
  //           }
  //         })(),
  //         click(item, focusedWindow) {
  //           if (focusedWindow) focusedWindow.toggleDevTools()
  //         }
  //       }
  //     ]
  //   },
  //   {
  //     label: 'Help',
  //     role: 'help',
  //     submenu: [
  //       {
  //         label: 'Learn More',
  //         click() { shell.openExternal('http://electron.atom.io') }
  //       }
  //     ]
  //   }
  // ]

  if (isDarwin) {
    const name = app.getName()
    template.unshift({
      label: name,
      submenu: [
        // {
        //   label: 'About ' + name,
        //   role: 'about'
        // },
        // {
        //   type: 'separator'
        // },
        preferencesMenuItem(),
        { type: 'separator' },
        {
          label: locale.translation('services'),
          role: 'services'
        },
        {
          label: locale.translation('hideBrave').replace('Brave','Sushi Browser'),
          accelerator: mainState.keyHideBrave,
          role: 'hide'
        },
        {
          label: locale.translation('hideOthers'),
          accelerator: mainState.keyHideOthers,
          role: 'hideothers'
        },
        {
          label: locale.translation('showAll'),
          role: 'unhide'
        },
        { type: 'separator' },
        {
          t: 'restartBrowser', label: locale.translation('restartBrowser'),
          accelerator: mainState.keyRestart,
          click() { ipcMain.emit('quit-browser',null,'restart') }
        },
        {
          label: locale.translation('quitApp').replace('Brave','Sushi Browser'),
          accelerator: mainState.keyQuit,
          click() { ipcMain.emit('quit-browser') }
        }
      ]
    })
  }
  return template
}

const exp = {
  updateMenu(){
    let oldMenu = appMenu
    appMenu = Menu.buildFromTemplate(getTemplate())
    Menu.setApplicationMenu(appMenu)

    if (oldMenu) {
      oldMenu.destroy()
    }
  },
  getTemplate
}

export default exp

exp.updateMenu()

