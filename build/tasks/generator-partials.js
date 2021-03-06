/* global fs, path, project */

module.exports = function(grunt) {
	grunt.registerTask('cachePartials', function(task) {
		var build = Wee.$toArray(project.generator.build),
			configPath = '../../' + build[task],
			json = fs.readJsonSync(configPath),
			staticRoot = path.dirname(configPath),
			partialRoot = path.join(staticRoot, json.config.paths.partials),
			partials = grunt.file.expand({
				cwd: partialRoot
			}, '**/*.html');

		partials.forEach(function(name) {
			var partial = path.join(partialRoot, name),
				content = fs.readFileSync(partial, 'utf8');

			Wee.view.addView(path.basename(name, path.extname(name)), content);
		});
	});
};