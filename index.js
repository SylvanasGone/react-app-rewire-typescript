const fs = require('fs')
const path = require('path')

const loaderNameMatches = function(rule, loader_name) {
  return (
    rule &&
    rule.loader &&
    typeof rule.loader === 'string' &&
    (rule.loader.indexOf(`${path.sep}${loader_name}${path.sep}`) !== -1 ||
      rule.loader.indexOf(`@${loader_name}${path.sep}`) !== -1)
  )
}

const babelLoaderMatcher = function(rule) {
  return loaderNameMatches(rule, 'babel-loader')
}

const getLoader = function(rules, matcher) {
  let loader

  rules.some(rule => {
    return (loader = matcher(rule)
      ? rule
      : getLoader(
          rule.use ||
            rule.oneOf ||
            (Array.isArray(rule.loader) && rule.loader) ||
            [],
          matcher
        ))
  })

  return loader
}

const getBabelLoader = function(rules) {
  return getLoader(rules, babelLoaderMatcher)
}

/**
 * @param {Object} rule
 * @return {Array}
 */
const ruleChildren = rule =>
  rule.use || rule.oneOf || (Array.isArray(rule.loader) && rule.loader) || []

const findIndexAndRules = (rulesSource, ruleMatcher) => {
  let result
  const rules = Array.isArray(rulesSource)
    ? rulesSource
    : ruleChildren(rulesSource)
  rules.some(
    (rule, index) =>
      (result = ruleMatcher(rule)
        ? { index, rules }
        : findIndexAndRules(ruleChildren(rule), ruleMatcher))
  )
  return result
}

const addFirstRule = (rules, value) => {
  rules.splice(0, 0, value)
}

/**
 * @param {object} config
 * @param {object} config.resolve
 * @param {string[]} config.resolve.extensions
 * @param {object} config.module
 * @param {any[]} config.module.rules
 * @param {string[]} config.entry
 */
function rewireTypescript(config, env, typescriptLoaderOptions = {}) {
  // Monkey patch react-scripts paths to use just `src` instead of
  // `src/index.js` specifically. Hopefully this can get removed at some point.
  // @see https://github.com/facebookincubator/create-react-app/issues/3052
  let paths = require('react-scripts/config/paths')
  if (paths) {
    paths.appIndexJs = path.resolve(fs.realpathSync(process.cwd()), 'src')
  }

  // Change the hardcoded `index.js` to just `index`, so that it will resolve as
  // whichever file is available. The use of `fs` is to handle things like
  // symlinks.
  config.entry = config.entry
    .slice(0, config.entry.length - 1)
    .concat([path.resolve(fs.realpathSync(process.cwd()), 'src/index')])

  // Set up a Typescript rule.
  const babelLoader = getBabelLoader(config.module.rules)
  const typescriptRules = {
    test: /\.tsx?$/,
    use: [
      { loader: babelLoader.loader, options: babelLoader.options },
      { loader: 'ts-loader', options: typescriptLoaderOptions }
    ]
  }

  // Add the Typescript rule in the first place of the file-loader rule.
  addFirstRule(config.module.rules, typescriptRules)

  return config
}

module.exports = rewireTypescript
