import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { upperFirst } from "lodash";

import { parseValue, stringifyValue } from "../utils/transform";
import { isEmptyValue } from "../utils/check";

const getInitialState = <T extends Record<string, any>>(
  initState: T,
  params: URLSearchParams
): T => {
  // 首先尝试从 URL 获取
  const urlState: Partial<T> = {};
  let hasUrlValue = false;

  for (const key in initState) {
    const value = params.get(key);
    if (value !== null) {
      urlState[key] = parseValue(value, initState[key]);
      hasUrlValue = true;
    }
  }

  if (hasUrlValue) return { ...initState, ...urlState };

  // 2. 如果 URL 没有，尝试从 localStorage 获取
  const localStorageState: Partial<T> = {};
  let hasLocalStorageValue = false;

  for (const key in initState) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      localStorageState[key] = parseValue(value, initState[key]);
      hasLocalStorageValue = true;
    }
  }

  return hasLocalStorageValue
    ? { ...initState, ...localStorageState }
    : initState;
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

/**
 * 自定义 Hook：同步 URL 和 localStorage 的状态管理.
 * 先从 URL 查询参数中获取数据，如果没有则从 localStorage 中获取，更新时会同时同步到 URL 和 localStorage.
 * 当更新值为空（空字符串、空数组等）时，会自动从 URL 和 localStorage 中删除对应的键.
 */
const useSyncLocalstorageAndUrl = <T extends Record<string, any>>(
  initialState: StateKeys<T>
): StateKeysReturn<T> => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [internalState, setInternalState] = useState<T>(() =>
    getInitialState(initialState, searchParams)
  );

  const updateState = <K extends keyof T>(key: K, value: T[K]) => {
    setInternalState((prev) => {
      const newState = { ...prev, [key]: value };
      const isEmpty = isEmptyValue(value);

      // 更新URL
      const newSearchParams = new URLSearchParams(searchParams);
      if (isEmpty) {
        newSearchParams.delete(key as string);
      } else {
        newSearchParams.set(key as string, stringifyValue(value));
      }
      setSearchParams(newSearchParams, { replace: true });

      // 更新localStorage
      if (isEmpty) {
        localStorage.removeItem(key as string);
      } else {
        localStorage.setItem(key as string, stringifyValue(value));
      }

      return newState;
    });
  };

  const result: any = {};
  for (const key in internalState) {
    // 添加状态值
    result[key] = internalState[key];

    // 添加setter方法 (set + 首字母大写的key)
    const setterKey = `set${upperFirst(key)}` as const;
    result[setterKey] = (value: T[typeof key]) => updateState(key, value);
  }

  return result as StateKeysReturn<T>;
};

export default useSyncLocalstorageAndUrl;
