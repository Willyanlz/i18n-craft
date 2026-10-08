import brFlag from 'flag-icons/flags/4x3/br.svg';
import cnFlag from 'flag-icons/flags/4x3/cn.svg';
import deFlag from 'flag-icons/flags/4x3/de.svg';
import esFlag from 'flag-icons/flags/4x3/es.svg';
import frFlag from 'flag-icons/flags/4x3/fr.svg';
import inFlag from 'flag-icons/flags/4x3/in.svg';
import itFlag from 'flag-icons/flags/4x3/it.svg';
import jpFlag from 'flag-icons/flags/4x3/jp.svg';
import krFlag from 'flag-icons/flags/4x3/kr.svg';
import nlFlag from 'flag-icons/flags/4x3/nl.svg';
import plFlag from 'flag-icons/flags/4x3/pl.svg';
import ruFlag from 'flag-icons/flags/4x3/ru.svg';
import saFlag from 'flag-icons/flags/4x3/sa.svg';
import seFlag from 'flag-icons/flags/4x3/se.svg';
import usFlag from 'flag-icons/flags/4x3/us.svg';
import { languages } from './core';

export const languageFlags: Record<string, string> = {
  pt: brFlag,
  en: usFlag,
  es: esFlag,
  fr: frFlag,
  de: deFlag,
  it: itFlag,
  ja: jpFlag,
  nl: nlFlag,
  pl: plFlag,
  ru: ruFlag,
  zh: cnFlag,
  ko: krFlag,
  ar: saFlag,
  hi: inFlag,
  sv: seFlag,
};

export const flagFor = (code: string) => languageFlags[code] || '';
export { languages };
