var _ = require('lodash');
var es = require('event-stream');
var path = require('path');
var gutil = require('gulp-util');
var concat = require('gulp-concat');
var header = require('gulp-header');
var footer = require('gulp-footer');

function templateCache(options) {
  return es.map(function(file, callback) {
    var template = '$templateCache.put("<%= url %>","<%= contents %>");';
    var url;

    file.path = path.normalize(file.path);

    if(_.isFunction(options.path)) {
      // 这里传入 file 对象作为第三个参数供接口使用
      url = path.join(options.path(file.path, file.base, file));
    } else {
      url = path.join(file.path);
      url = url.replace(file.base, '');
    };

    if (process.platform === 'win32') {
      url = url.replace(/\\/g, '/');
    }

    var contents = file.contents.toString();

    contents = require('js-string-escape')(contents);

    file.contents = new Buffer(gutil.template(template, {
      url: url,
      contents: contents,
      file: file
    }));

    callback(null, file);
  });
}

module.exports = function(options, filename) {
  /**
   * 代码执行的模式
   * run: 直接加载执行
   * service: 注册为一个服务，可以自己注入执行
   */
  var execMode = {
    run: {
      header: 'angular.module("<%= module %>"<%= standalone %>).run(["$templateCache", function($templateCache) {',
      footer: '}]);'
    },
    service: {
      header: function(serviceName) {
        return 'angular.module("<%= module %>"<%= standalone %>).service("' + serviceName + '", ["$templateCache", function($templateCache) {this.init=function(){';
      },
      footer: '}}]);'
    }
  };

  var defaults = {
    standalone: true,
    module: 'templates',
    filename: 'templates.min.js',
    header: execMode.run.header,
    footer: execMode.run.footer
  };

  if(_.isUndefined(options)) {
    options = {};
  } else if(_.isString(options)) {
    options = {
      module: options
    };
  } 

  if(!_.isUndefined(filename)) {
    options.filename = filename;
  }

  options = _.defaults(options, defaults);

  if(options.execMode === 'service') {
    var serviceName = 'templateCache';
    if(!_.isUndefined(options.serviceName)) {
      serviceName = options.serviceName;
    }
    options.header = execMode.service.header(serviceName);
    options.footer = execMode.service.footer; 
  }

  return es.pipeline(
    templateCache(options),
    concat(options.filename),
    header(options.header, {
      module: options.module,
      standalone: (options.standalone ? ', []' : '')
    }),
    footer(options.footer)
  );
};