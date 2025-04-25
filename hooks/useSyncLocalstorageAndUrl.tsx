import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { upperFirst } from "lodash";

import { parseValue, stringifyValue } from "../utils/transform";
import { isEmptyValue } from "../utils/check";

const LOCAL_STORAGE_KEY = "__XXX__";

const getLocalStorage = <T extends Record<string, any>>(): T | undefined => {
  const localStorageString = localStorage.getItem(LOCAL_STORAGE_KEY) ?? "{}";
  try {
    return JSON.parse(localStorageString);
  } catch (_) {
    return undefined;
  }
};

const setLocalStorage = <T extends Record<string, any>>(value: T) => {
  const prevLocalStorage = getLocalStorage<T>();
  localStorage.setItem(
    LOCAL_STORAGE_KEY,
    stringifyValue({ ...prevLocalStorage, ...value })
  );
};

const getInitialState = <T extends Record<string, any>>(
  initialState: T,
  params: URLSearchParams
): T => {
  // 1. 首先尝试从 URL 获取
  const urlState: Partial<T> = {};
  let hasUrlValue = false;

  for (const key in initialState) {
    const value = params.get(key);
    if (value !== null) {
      urlState[key] = parseValue(value, initialState[key]);
      hasUrlValue = true;
    }
  }

  if (hasUrlValue) return { ...initialState, ...urlState };

  // 2. 如果 URL 没有，尝试从 localStorage 获取
  const localStorageState: Partial<T> = {};
  let hasLocalStorageValue = false;

  const localStorageObject = getLocalStorage<T>();
  if (localStorageObject) {
    for (const key in initialState) {
      const value = localStorageObject[key];
      if (!isEmptyValue(value)) {
        localStorageState[key] = value;
        hasLocalStorageValue = true;
      }
    }
  }

  return hasLocalStorageValue
    ? { ...initialState, ...localStorageState }
    : initialState;
};

type StateKeys<T> = {
  [K in keyof T]: T[K];
};

type StateKeysReturn<T> = {
  [K in keyof T as K extends string ? K : never]: T[K];
} & {
  [K in keyof T as K extends string ? `set${Capitalize<K>}` : never]: (
    value: T[K]
  ) => void;
};

const useSyncLocalstorageAndUrl = <T extends Record<string, any>>(
  initialState: StateKeys<T>
): StateKeysReturn<T> => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [internalState, setInternalState] = useState<T>(() =>
    getInitialState(initialState, searchParams)
  );

  // url 为空时，将 internalState 更新到 url 上
  useEffect(() => {
    let hasUrlValue = false;
    for (const key in initialState) {
      const value = searchParams.get(key);
      if (value !== null) {
        hasUrlValue = true;
      }
    }

    // 遍历对象，只添加有值的属性
    if (!isEmptyValue(internalState) && !hasUrlValue) {
      const newSearchParams = new URLSearchParams();
      Object.entries(internalState).forEach(([key, value]) => {
        if (!isEmptyValue(value)) {
          newSearchParams.append(key, String(value));
        }
      });
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [initialState, internalState, searchParams, setSearchParams]);

  const updateState = <K extends keyof T>(key: K, value: T[K]) => {
    setInternalState((prev) => {
      const newState = { ...prev, [key]: value };

      // 更新URL
      const newSearchParams = new URLSearchParams(searchParams);
      if (isEmptyValue(value)) {
        newSearchParams.delete(key as string);
      } else {
        newSearchParams.set(key as string, stringifyValue(value));
      }
      setSearchParams(newSearchParams, { replace: true });

      // 更新localStorage
      setLocalStorage(newState);

      return newState;
    });
  };

  const result: any = {};
  for (const key in internalState) {
    // 添加状态值
    result[key] = internalState[key];

    // 添加 setter 方法 (set + 首字母大写的key)
    const setterKey = `set${upperFirst(key)}` as const;
    result[setterKey] = (value: T[typeof key]) => updateState(key, value);
  }

  return result as StateKeysReturn<T>;
};

export default useSyncLocalstorageAndUrl;
