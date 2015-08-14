/* global __dirname */

(function() {
	'use strict';

	module.exports = function(config) {
		var fs = require('fs-extra'),
			path = require('path'),
			glob = require('glob');

		require('../script/wee.view');

		var error = false,
			message = false,
			templatePath = __dirname + '/../templates/',
			sourcePath = path.join(config.rootPath, config.project.paths.source),
			commands = {
				controller: function() {
					var name = config.args.name || '',
						target = path.join(sourcePath, 'js/build/' + name + '.js');

					if (! name) {
						error = 'Missing argument "--name=controllerName"';
					} else if (fs.existsSync(target)) {
						error = 'Controller "' + target + '" already exists';
					}

					if (! error) {
						var template = fs.readFileSync(templatePath + 'controller/base.js', 'utf8'),
							parsed = Wee.view.render(template, config.args);

						fs.outputFileSync(target, parsed);

						message = 'Controller generated at "' + target + '"';
					}
				},
				module: function() {
					var name = config.args.name || '',
						slug = (name[0].toLowerCase() + name.slice(1))
							.replace(' ', ''),
						target = path.join(sourcePath, 'modules/' + slug);

					if (! name) {
						error = 'Missing argument "--name=Module"';
					} else if (fs.existsSync(target)) {
						error = 'Module "' + name + '" already exists';
					}

					if (! error) {
						var moduleTemplate = path.join(templatePath, 'module'),
							files = glob.sync(path.join(moduleTemplate, '/**/*')),
							args = Wee.$extend({
								author: 'test',
								autoload: 'true',
								website: '',
								description: ''
							}, config.args);

						files.forEach(function(file) {
							var name = file.replace(moduleTemplate, '');

							if (fs.statSync(file).isFile()) {
								var template = fs.readFileSync(file, 'utf8'),
									parsed = Wee.view.render(template, args);

								fs.outputFileSync(path.join(target, name), parsed);
							}
						});

						message = 'Module generated at "' + target + '"';
					}
				},
				test: function() {
					var name = config.args.name,
						type = config.args.type || 'unit',
						types = [
							'unit',
							'functional'
						],
						target = path.join(sourcePath,';js/tests/' + type + '/' + name + '.js');

					if (! name) {
						error = 'Missing argument "--name=testName"';
					} else if (types.indexOf(type) < 0) {
						error = 'Invalid test type "' + type + '"';
					} else if (fs.existsSync(target)) {
						error = 'Test "' + target + '" already exists';
					}

					if (! error) {
						var template = fs.readFileSync(templatePath + 'test/unit.js', 'utf8'),
							parsed = Wee.view.render(template, config.args);

						fs.outputFileSync(target, parsed);

						message = 'Test generated at "' + target + '"';
					}
				}
			};

		if (config.options.length) {
			var type = config.options[0],
				command = commands[type];

			if (command) {
				command();
			} else {
				error = 'Generator "' + type + '" not registered';
			}
		} else {
			error = 'Missing required generator type';
		}

		if (error) {
			Wee.notify({
				title: 'Generator Error',
				message: error
			}, 'error');
		} else {
			Wee.notify({
				title: 'Generation Successful',
				message: message || 'Generator successfully executed'
			});
		}

		return;
	};
})();