export const strToLocale = (str) => {
  str = str.toLowerCase();
  let locale;
  if (str.startsWith("de")) locale = "de";
  else if (str.startsWith("sq")) locale = "sq";
  else if (str.startsWith("en")) locale = "en";
  else if (str.startsWith("bs")) locale = "bs";
  else if (str.startsWith("tr")) locale = "tr";
  else if (str.startsWith("fr")) locale = "fr";
  else if (str.startsWith("ar")) locale = "ar";
  else if (str.startsWith("it")) locale = "it";
  else locale = "de";
  return locale;
};

export const languageIdToLocale = (id) => {
  let locale;
  if (id === "101") locale = "de";
  else if (id === "102") locale = "sq";
  else if (id === "103") locale = "bs";
  else if (id === "104") locale = "tr";
  else if (id === "105") locale = "fr";
  else if (id === "106") locale = "en";
  else if (id === "107") locale = "ar";
  else if (id === "108") locale = "it";
  else locale = "de";
  return locale;
};

export const localeToLanguageId = (locale) => {
  let id;
  if (locale.startsWith("de")) id = "101";
  else if (locale.startsWith("sq")) id = "102";
  else if (locale.startsWith("bs")) id = "103";
  else if (locale.startsWith("tr")) id = "104";
  else if (locale.startsWith("fr")) id = "105";
  else if (locale.startsWith("en")) id = "106";
  else if (locale.startsWith("ar")) id = "107";
  else if (locale.startsWith("it")) id = "108";
  else id = "101";
  return id;
};

export const urlQueryToObject = (query) => {
  const urlParams = new URLSearchParams(query);
  const entries = urlParams.entries();
  const result = {};
  for (const [key, value] of entries) {
    result[key] = value;
  }
  return result;
};

export const objectToUrlQuery = (obj) => {
  const _obj = Object.entries(obj).reduce((acc, [key, val]) => {
    if (!val) return acc;
    return {
      ...acc,
      [key]: val,
    };
  }, {});
  return new URLSearchParams(_obj).toString();
};

export const addOrModifyQuery = (query, changes) => {
  return objectToUrlQuery({
    ...urlQueryToObject(query),
    ...changes,
  });
};

export const pad = (n, width, z) => {
  z = z || "0";
  n = n + "";
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};

export const capitalize = (string) => {
  if (!string || typeof string !== "string") return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
};
