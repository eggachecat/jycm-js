import { make_ignore_order_func } from './helper';
import { YouchamaJsonDiffer } from './jycm';
import { getOperatorListFromJSON } from './operator';

export * from './jycm';
export * from './operator';
export * from './helper';
export * from './km_matcher';

export function get_jycm_instance_from_json(
    left: any,
    right: any,
    config: {
        operators?: { name: string; args: any }[];
        ignore_orders?: string[];
    }
) {
    return new YouchamaJsonDiffer(left, right, {
        custom_operators: getOperatorListFromJSON(config.operators || []),
        ignore_order_func: config.ignore_orders
            ? make_ignore_order_func(config.ignore_orders)
            : null
    });
}
