import { TreeLevel } from "./jycm"

export const PLACE_HOLDER_NON_EXIST = "__NON_EXIST__"
export const EVENT_PAIR = "just4vis:pairs"
export const EVENT_DICT_REMOVE = "dict:remove"
export const EVENT_DICT_ADD = "dict:add"
export const EVENT_LIST_REMOVE = "list:remove"
export const EVENT_LIST_ADD = "list:add"
export const EVENT_VALUE_CHANGE = "value_changes"


export function make_json_path_key(path_list: Array<string | number>): string {
    return path_list.map(v => typeof v === 'number' ? `[${v}]` : v).join("->");
}

export function make_ignore_order_func(path_regex_list: string[]){
    const matcher_list = path_regex_list.map(s => new RegExp(s));

    return (level: TreeLevel, drill: boolean) => {
        for(let matcher of matcher_list) {
            if( null !== level.get_path().match(matcher)) {
                return true
            }
        }
        return false
    }
}


