---
type: docs
title: "Writing Plugins"
permalink: docs/writing-plugins/
order: 8
category: "Contributing"
---

There are already a few useful Uppy plugins out there, but there might come a time when you will want to build your own. Plugins can hook into the upload process or render a custom UI, typically to:

 - Render some custom UI element, e.g., [StatusBar](/docs/statusbar) or [Dashboard](/docs/dashboard).
 - Do the actual uploading, e.g., [XHRUpload](/docs/xhrupload) or [Tus](/docs/tus).
 - Do work before the upload, like compressing an image or calling external API.
 - Interact with a third-party service to process uploads correctly, e.g., [Transloadit](/docs/transloadit) or [AwsS3](/docs/aws-s3).

See a [full example of a plugin](#Example-of-a-custom-plugin) below.

## Creating A Plugin

Uppy has two classes to create plugins with. `BasePlugin` for plugins that don't require an user interface, and `UIPlugin` for onces that do.
Each plugin has an `id` and a `type`. `id`s are used to uniquely identify plugins.
A `type` can be anything—some plugins use `type`s to determine whether to do something to some other plugin.
For example, when targeting plugins at the built-in `Dashboard` plugin, the Dashboard uses the `type` to figure out where to mount different UI elements.
`'acquirer'`-type plugins are mounted into the tab bar, while `'progressindicator'`-type plugins are mounted into the progress bar area.

The plugin constructor receives the Uppy instance in the first parameter, and any options passed to `uppy.use()` in the second parameter.

```js
import BasePlugin from '@uppy/core/lib/BasePlugin.js'

export default class MyPlugin extends BasePlugin {
  constructor (uppy, opts) {
    super(uppy, opts)
    this.id = opts.id || 'MyPlugin'
    this.type = 'example'
  }
}
```

## Methods

Plugins can implement methods in order to execute certain tasks. The most important method is `install()`, which is called when a plugin is `.use`d.

All of the below methods are optional! Only implement the methods you need.

### `BasePlugin`

#### `install()`

Called when the plugin is `.use`d. Do any setup work here, like attaching events or adding [upload hooks](#Upload-Hooks).

```js
export default class MyPlugin extends UIPlugin {
  // ...
  install () {
    this.uppy.on('upload-progress', this.onProgress)
    this.uppy.addPostProcessor(this.afterUpload)
  }
}
```

#### `uninstall()`

Called when the plugin is removed, or the Uppy instance is closed. This should undo all of the work done in the `install()` method.

```js
export default class MyPlugin extends UIPlugin {
  // ...
  uninstall () {
    this.uppy.off('upload-progress', this.onProgress)
    this.uppy.removePostProcessor(this.afterUpload)
  }
}
```

#### `afterUpdate()`

Called after every state update with a debounce, after everything has mounted.

#### `addTarget()`

Use this to add your plugin to another plugin's target. This is what `@uppy/dashboard` uses to add other plugins to its UI.

### `UIPlugin`

`UIPlugin` extends the `BasePlugin` class so it will also contain all the above methods.

#### `mount(target)`

Mount this plugin to the `target` element. `target` can be a CSS query selector, a DOM element, or another Plugin. If `target` is a Plugin, the source (current) plugin will register with the target plugin, and the latter can decide how and where to render the source plugin.

This method can be overridden to support for different render engines.

#### `render()`

Render this plugin's UI. Uppy uses [Preact](https://preactjs.com) as its view engine, so `render()` should return a Preact element.
`render` is automatically called by Uppy on each state change.

#### `onMount()`

Called after Preact has rendered the components of the plugin. Can be used to perform additional side-effects.

#### `update(state)`

Called on each state update. You will rarely need to use this, it is mostly handy if you want to build a UI plugin using something other than Preact.

#### `onUnmount()`

Called after the elements have been removed from the DOM. Can be used to perform additional (clean up) side-effects.

## Upload Hooks

When creating an upload, Uppy runs files through an upload pipeline. The pipeline consists of three parts, each of which can be hooked into: Preprocessing, Uploading, and Postprocessing. Preprocessors can be used to configure uploader plugins, encrypt files, resize images, etc., before uploading them. Uploaders do the actual uploading work, such as creating an XMLHttpRequest object and sending the file. Postprocessors do their work after files have been uploaded completely. This could be anything from waiting for a file to propagate across a CDN, to sending another request to relate some metadata to the file.

Each hook is a function that receives an array containing the file IDs that are being uploaded, and returns a Promise to signal completion. Hooks are added and removed through `Uppy` methods: `addPreProcessor`, `addUploader`, `addPostProcessor`, and their `remove*` counterparts. Normally, hooks should be added during the plugin's `install()` method, and removed during the `uninstall()` method.

Additionally, upload hooks can fire events to signal progress.

When adding hooks, make sure to bind the hook `fn` beforehand! Otherwise, it will be impossible to remove. For example:

```js
class MyPlugin extends BasePlugin {
  constructor (uppy, opts) {
    super(uppy, opts)
    this.id = opts.id || 'MyPlugin'
    this.type = 'example'
    this.prepareUpload = this.prepareUpload.bind(this) // ← this!
  }

  prepareUpload (fileIDs) {
    console.log(this) // `this` refers to the `MyPlugin` instance.
    return Promise.resolve()
  }

  install () {
    this.uppy.addPreProcessor(this.prepareUpload)
  }

  uninstall () {
    this.uppy.removePreProcessor(this.prepareUpload)
  }
}
```

### `addPreProcessor(fn)`

Add a preprocessing function. `fn` gets called with a list of file IDs before an upload starts. `fn` should return a Promise. Its resolution value is ignored. To change file data and such, use Uppy state updates, for example using [`setFileState`][core.setfilestate].

### `addUploader(fn)`

Add an uploader function. `fn` gets called with a list of file IDs when an upload should start. Uploader functions should do the actual uploading work, such as creating and sending an XMLHttpRequest or calling into some upload service's SDK. `fn` should return a Promise that resolves once all files have been uploaded.

You may choose to still resolve the Promise if some file uploads fail. This way, any postprocessing will still run on the files that were uploaded successfully, while uploads that failed will be retried when `uppy.retryAll` is called.

### `addPostProcessor(fn)`

Add a postprocessing function. `fn` is called with a list of file IDs when an upload has finished. `fn` should return a Promise that resolves when the processing work is complete. Again, the resolution value of the Promise is ignored. This hook can be used to do any finishing work. For example, you could wait for file encoding or CDN propagation to complete, or you could do an HTTP API call to create an album containing all images that were just uploaded.

### `removePreProcessor/removeUploader/removePostProcessor(fn)`

Remove a processor or uploader function that was added previously. Normally, this should be done in the `uninstall()` method.

## Progress events

Progress events can be fired for individual files to show feedback to the user. For upload progress events, only emitting how many bytes are expected and how many have been uploaded is enough. Uppy will handle calculating progress percentages, upload speed, etc.

Preprocessing and postprocessing progress events are plugin-dependent and can refer to anything, so Uppy doesn't try to be smart about them. There are two types of processing progress events: determinate and indeterminate. Some processing does not have meaningful progress beyond "not done" and "done". For example, sending a request to initialize a server-side resource that will serve as the upload destination. In those situations, indeterminate progress is suitable. Other processing does have meaningful progress. For example, encrypting a large file. In those situations, determinate progress is suitable.

### `preprocess-progress(fileID, progress)`

`progress` is an object with properties:

 - `mode` - Either `'determinate'` or `'indeterminate'`.
 - `message` - A message to show to the user. Something like `'Preparing upload...'`, but be more specific if possible.

When `mode` is `'determinate'`, also add the `value` property:

 - `value` - A progress value between 0 and 1.

### `upload-progress(progress)`

`progress` is an object with properties:

 - `uploader` - The uploader plugin that fired the event (`this`).
 - `id` - The file ID.
 - `bytesTotal` - The full amount of bytes to be uploaded.
 - `bytesUploaded` - The amount of bytes that have been uploaded so far.

### `postprocess-progress(fileID, progress)`

`progress` is an object with properties:

 - `mode` - Either `'determinate'` or `'indeterminate'`.
 - `message` - A message to show to the user. Something like `'Preparing upload...'`, but be more specific if possible.

When `mode` is `'determinate'`, also add the `value` property:

 - `value` - A progress value between 0 and 1.

 ### `error(err\[, fileID\])

 `err` is an `Error` object. `fileID` can optionally which file fails to inform the user.


### JSX

Since Uppy uses Preact and not React, the default Babel configuration for JSX elements does not work.
You have to import the Preact `h` function and tell Babel to use it by adding a `/** @jsx h */` comment at the top of the file.

See the Preact [Getting Started Guide](https://preactjs.com/guide/getting-started) for more on Babel and JSX.

<!-- eslint-disable jsdoc/check-tag-names -->
```js
/** @jsx h */
import { UIPlugin } from '@uppy/core'
import { h } from 'preact'

class NumFiles extends UIPlugin {
  render () {
    const numFiles = Object.keys(this.uppy.state.files).length

    return (
      <div>
        Number of files:
        {' '}
        {numFiles}
      </div>
    )
  }
}
```

## Locales

For any user facing language that you use while writing your Plugin, please provide them as strings in the `defaultLocale` property like so:

```js
this.defaultLocale = {
  strings: {
    youCanOnlyUploadFileTypes: 'You can only upload: %{types}',
    youCanOnlyUploadX: {
      0: 'You can only upload %{smart_count} file',
      1: 'You can only upload %{smart_count} files',
      2: 'You can only upload %{smart_count} files',
    },
  },
}
```

This allows them to be overridden by Locale Packs, or directly when users pass `locale: { strings: youCanOnlyUploadFileTypes: 'Something else completely about %{types}'} }`. For this to work, it’s also required that you call `this.i18nInit()` in the plugin constructor.

## Example of a custom plugin

Below is a full example of a [small plugin](https://github.com/arturi/uppy-plugin-image-compressor) that compresses images before uploading them. You can replace `compressorjs` method with any other work you need to do. This works especially well for async stuff, like calling an external API.

<!-- eslint-disable consistent-return -->
```js
import { UIPlugin } from '@uppy/core'
import Translator from '@uppy/utils/lib/Translator'
import Compressor from 'compressorjs/dist/compressor.esm.js'

class UppyImageCompressor extends UIPlugin {
  constructor (uppy, opts) {
    const defaultOptions = {
      quality: 0.6,
    }
    super(uppy, { ...defaultOptions, ...opts })

    this.id = this.opts.id || 'ImageCompressor'
    this.type = 'modifier'

    this.defaultLocale = {
      strings: {
        compressingImages: 'Compressing images...',
      },
    }

    // we use those internally in `this.compress`, so they
    // should not be overriden
    delete this.opts.success
    delete this.opts.error

    this.i18nInit()
  }

  compress (blob) {
    return new Promise((resolve, reject) => new Compressor(blob, ({
      ...this.opts,
      success (result) {
        return resolve(result)
      },
      error (err) {
        return reject(err)
      },
    })))
  }

  prepareUpload = (fileIDs) => {
    const promises = fileIDs.map((fileID) => {
      const file = this.uppy.getFile(fileID)
      this.uppy.emit('preprocess-progress', file, {
        mode: 'indeterminate',
        message: this.i18n('compressingImages'),
      })

      if (!file.type.startsWith('image/')) {
        return
      }

      return this.compress(file.data).then((compressedBlob) => {
        this.uppy.log(`[Image Compressor] Image ${file.id} size before/after compression: ${file.data.size} / ${compressedBlob.size}`)
        this.uppy.setFileState(fileID, { data: compressedBlob })
      }).catch((err) => {
        this.uppy.log(`[Image Compressor] Failed to compress ${file.id}:`, 'warning')
        this.uppy.log(err, 'warning')
      })
    })

    const emitPreprocessCompleteForAll = () => {
      fileIDs.forEach((fileID) => {
        const file = this.uppy.getFile(fileID)
        this.uppy.emit('preprocess-complete', file)
      })
    }

    // Why emit `preprocess-complete` for all files at once, instead of
    // above when each is processed?
    // Because it leads to StatusBar showing a weird “upload 6 files” button,
    // while waiting for all the files to complete pre-processing.
    return Promise.all(promises)
      .then(emitPreprocessCompleteForAll)
  }

  install () {
    this.uppy.addPreProcessor(this.prepareUpload)
  }

  uninstall () {
    this.uppy.removePreProcessor(this.prepareUpload)
  }
}

export default UppyImageCompressor
```

[core.setfilestate]: /docs/uppy#uppy-setFileState-fileID-state
