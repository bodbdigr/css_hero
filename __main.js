import { readFileSync, writeFileSync } from 'fs';
import { parse, stringify } from '@adobe/css-tools';
import { parse as parseHTML } from 'node-html-parser';



const f = await readFileSync('f.css', { encoding: 'utf8', flag: 'r' });
const fhtml = await readFileSync('source.html', { encoding: 'utf8', flag: 'r' });

console.time('html');

const root = parseHTML(fhtml);

// const { window } = new JSDOM(fhtml);
// const root = window.document;


if (result.stylesheet.parsingErrors) {
  console.log('Parsing errors:', result.stylesheet.parsingErrors.length)
  result.stylesheet.parsingErrors.forEach(error => {
    console.log(`Error at line ${error.line}: ${error.message}`);
  });
}

var selectors = []

function isUsedSelector(rule) {
  try {
    const fullSelector = rule.selectors
      .map(selector => {
        selectors.push(selector);
        return selector.replaceAll(':after', '').replaceAll(':before', '')
      })
      .join(',');

    if (fullSelector.includes(':root')) {
      return true;
    }

    // return !!root.querySelector(fullSelector)
    return true;
  } catch(e) {
    return false;
  }
}

function processDeclarationUrls(rule) {
  let { declarations } = rule;

  declarations = declarations.map(function onDeclaration(declaration) {
    let { value } = declaration;
    value = value
      .replaceAll('url(images/', 'url(https://assets.boredpanda.com/blog/wp-content/themes/boredpanda/images/')
      .replaceAll('url("images/', 'url("https://assets.boredpanda.com/blog/wp-content/themes/boredpanda/images/')
      .replaceAll('url("fonts/', 'url("https://assets.boredpanda.com/blog/wp-content/themes/boredpanda/fonts/');

    return { ...declaration, value };
  });

  return {...rule, declarations};
}

const newRules = result.stylesheet.rules.filter(function perRule(rule) {
  if (rule.type == "rule") {
    return isUsedSelector(rule);
  } else if (rule.type == "media") {
    return rule.rules.some(isUsedSelector);
  } else {
      return true;
  }
}).map(function mapRules(rule) {
  if (rule.type == "rule") {
    return processDeclarationUrls(rule);
  } else if (rule.type == "media") {
    return {
      ...rule,
      rules: rule.rules.map(processDeclarationUrls),
    }
  } else if (rule.type == "font-face") {
    return processDeclarationUrls(rule);
  } else {
      return rule;
  }
});


result.stylesheet.rules = newRules;

const css = stringify(result, { compress: true });

console.timeEnd('html');

await writeFileSync('selectors.json', JSON.stringify(selectors));

await writeFileSync('f2.css', css);

