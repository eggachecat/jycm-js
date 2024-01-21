import { make_ignore_order_func } from '../src/helper';
import { YouchamaJsonDiffer } from '../src/jycm';

describe('testing general', () => {
    test('diff with primitives', () => {
        const left = {
            a: 1,
            b: 2,
            d: '12345',
            f: false,
            e: [
                { x: 1, y: 1 },
                { x: 2, y: 2 },
                { x: 3, y: 3 },
                { x: 4, y: 4 }
            ],
            g: ['1', '3']
        };

        const right = {
            a: 1,
            b: 3,
            c: 4,
            f: true,
            e: [
                { x: 0, y: 1 },
                { x: 2, y: 2 },
                { x: 3, y: 3 },
                { x: 5, y: 5 }
            ],
            g: ['3']
        };

        const expected = {
            'dict:add': [
                {
                    left: '__NON_EXIST__',
                    left_path: '',
                    right: 4,
                    right_path: 'c'
                }
            ],
            'dict:remove': [
                {
                    left: '12345',
                    left_path: 'd',
                    right: '__NON_EXIST__',
                    right_path: ''
                }
            ],
            'list:add': [
                {
                    left: '__NON_EXIST__',
                    left_path: '',
                    right: { x: 5, y: 5 },
                    right_path: 'e->[3]'
                }
            ],
            'list:remove': [
                {
                    left: { x: 4, y: 4 },
                    left_path: 'e->[3]',
                    right: '__NON_EXIST__',
                    right_path: ''
                },
                {
                    left: "1",
                    left_path: 'g->[0]',
                    right: '__NON_EXIST__',
                    right_path: ''
                }
            ],
            value_changes: [
                {
                    left: 2,
                    left_path: 'b',
                    new: 3,
                    old: 2,
                    right: 3,
                    right_path: 'b'
                },
                {
                    left: 1,
                    left_path: 'e->[0]->x',
                    new: 0,
                    old: 1,
                    right: 0,
                    right_path: 'e->[0]->x'
                },
                {
                    left: false,
                    left_path: 'f',
                    new: true,
                    old: false,
                    right: true,
                    right_path: 'f'
                }
            ]
        };

        const ycm = new YouchamaJsonDiffer(left, right);
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });

    test('diff with different types', () => {
        const left = {
            b: 2,
            e: [
                { x: 1, y: 1 },
                { x: 2, y: 2 },
                { x: 3, y: 3 },
                { x: 4, y: 4 }
            ]
        };

        const right = {
            b: null,
            e: null
        };
        const expected = {
            value_changes: [
                {
                    left: 2,
                    right: null,
                    left_path: 'b',
                    right_path: 'b',
                    old: 2,
                    new: null
                },
                {
                    left: [
                        { x: 1, y: 1 },
                        { x: 2, y: 2 },
                        { x: 3, y: 3 },
                        { x: 4, y: 4 }
                    ],
                    right: null,
                    left_path: 'e',
                    right_path: 'e',
                    old: [
                        { x: 1, y: 1 },
                        { x: 2, y: 2 },
                        { x: 3, y: 3 },
                        { x: 4, y: 4 }
                    ],
                    new: null
                }
            ]
        };
        expect(
            new YouchamaJsonDiffer(left, right).get_diff(true)
        ).toStrictEqual(expected);
        expect(
            new YouchamaJsonDiffer(left, right, { use_cache: false }).get_diff(
                true
            )
        ).toStrictEqual(expected);
    });
});

describe('testing without order', () => {
    test('diff with ignore_order_func', () => {
        const left = {
            ignore_order: [1, 2, 3],
            not_ignore_order: [1, 2, 3]
        };

        const right = {
            ignore_order: [3, 2, 1],
            not_ignore_order: [3, 2, 1]
        };

        const expected = {
            'list:add': [
                {
                    left: '__NON_EXIST__',
                    left_path: '',
                    right: 2,
                    right_path: 'not_ignore_order->[1]'
                },
                {
                    left: '__NON_EXIST__',
                    left_path: '',
                    right: 1,
                    right_path: 'not_ignore_order->[2]'
                }
            ],
            'list:remove': [
                {
                    left: 1,
                    left_path: 'not_ignore_order->[0]',
                    right: '__NON_EXIST__',
                    right_path: ''
                },
                {
                    left: 2,
                    left_path: 'not_ignore_order->[1]',
                    right: '__NON_EXIST__',
                    right_path: ''
                }
            ]
        };

        const ycm = new YouchamaJsonDiffer(left, right, {
            ignore_order_func: make_ignore_order_func(['^ignore_order$'])
        });
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });

    test('diff with ignore_order_func', () => {
        const left = {
            ignore_order: [1, 2, 2, 3]
        };

        const right = {
            ignore_order: [3, 2, 2, 1]
        };

        const expected = {};

        const ycm = new YouchamaJsonDiffer(left, right, {
            ignore_order_func: make_ignore_order_func(['^ignore_order$'])
        });
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });
});

describe('testing array', () => {
    test('diff with the same lists', () => {
        const left = {
            v: [1, 2, 3]
        };

        const right = {
            v: [1, 2, 3]
        };
        const expected = {};

        const ycm = new YouchamaJsonDiffer(left, right);
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });

    test('diff with lists', () => {
        const left = {
            v: [
                { a: 1, b: 2, c: 3 },
                { c: 1, d: 2, e: 3 },
                { f: 1, g: 2, h: 3 },
                { x: 1, y: 2 }
            ],
            s: []
        };

        const right = {
            v: [
                { a: 1, b: 2, c: 8 },
                { c: 1, d: 12, e: 3 },
                { f: 11, g: 2, h: 3 },
                { z: 1 },
                2
            ],
            s: []
        };
        const expected = {
            'list:add': [
                {
                    left: '__NON_EXIST__',
                    right: { z: 1 },
                    left_path: '',
                    right_path: 'v->[3]'
                },
                {
                    left: '__NON_EXIST__',
                    right: 2,
                    left_path: '',
                    right_path: 'v->[4]'
                }
            ],
            'list:remove': [
                {
                    left: { x: 1, y: 2 },
                    right: '__NON_EXIST__',
                    left_path: 'v->[3]',
                    right_path: ''
                }
            ],
            value_changes: [
                {
                    left: 3,
                    right: 8,
                    left_path: 'v->[0]->c',
                    right_path: 'v->[0]->c',
                    old: 3,
                    new: 8
                },
                {
                    left: 2,
                    right: 12,
                    left_path: 'v->[1]->d',
                    right_path: 'v->[1]->d',
                    old: 2,
                    new: 12
                },
                {
                    left: 1,
                    right: 11,
                    left_path: 'v->[2]->f',
                    right_path: 'v->[2]->f',
                    old: 1,
                    new: 11
                }
            ]
        };

        const ycm = new YouchamaJsonDiffer(left, right);
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });

    test('diff with lists', () => {
        const left = {
            v: [9, 1, 2, 3, 7]
        };

        const right = {
            v: [0, 1, 3, 4]
        };
        const expected = {
            'list:add': [
                {
                    left: '__NON_EXIST__',
                    left_path: '',
                    right: 0,
                    right_path: 'v->[0]'
                },
                {
                    left: '__NON_EXIST__',
                    left_path: '',
                    right: 4,
                    right_path: 'v->[3]'
                }
            ],
            'list:remove': [
                {
                    left: 9,
                    left_path: 'v->[0]',
                    right: '__NON_EXIST__',
                    right_path: ''
                },
                {
                    left: 2,
                    left_path: 'v->[2]',
                    right: '__NON_EXIST__',
                    right_path: ''
                },
                {
                    left: 7,
                    left_path: 'v->[4]',
                    right: '__NON_EXIST__',
                    right_path: ''
                }
            ]
        };

        const ycm = new YouchamaJsonDiffer(left, right);
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });

    test('diff with list directly', () => {
        const left = [
            {
                id: 2,
                label: 'label:2'
            },
            {
                id: 1,
                label: 'label:1'
            },
            {
                id: 5,
                label: 'label:5'
            }
        ];

        const right = [
            {
                id: 9,
                label: 'label:9'
            },
            {
                id: 1,
                label: 'label:1'
            },
            {
                id: 5,
                label: 'label:9'
            }
        ];
        const expected = {
            'list:add': [
                {
                    left: '__NON_EXIST__',
                    right: { id: 9, label: 'label:9' },
                    left_path: '',
                    right_path: '[0]'
                }
            ],
            'list:remove': [
                {
                    left: { id: 2, label: 'label:2' },
                    right: '__NON_EXIST__',
                    left_path: '[0]',
                    right_path: ''
                }
            ],
            value_changes: [
                {
                    left: 'label:5',
                    right: 'label:9',
                    left_path: '[2]->label',
                    right_path: '[2]->label',
                    old: 'label:5',
                    new: 'label:9'
                }
            ]
        };

        const ycm = new YouchamaJsonDiffer(left, right);
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });

    test('diff with the sets in sets', () => {
        const left = {
            set_in_set: [
                {
                    id: 1,
                    label: 'label:1',
                    set: [1, 2, 3]
                },
                {
                    id: 2,
                    label: 'label:2',
                    set: [4, 5, 6]
                }
            ]
        };

        const right = {
            set_in_set: [
                {
                    id: 2,
                    label: 'label:2',
                    set: [6, 5, 4]
                },
                {
                    id: 1,
                    label: 'label:1',
                    set: [3, 2, 1]
                }
            ]
        };
        const expected = {};

        const ycm = new YouchamaJsonDiffer(left, right, {
            ignore_order_func: make_ignore_order_func([
                '^set_in_set$',
                '^set_in_set->\\[\\d+\\]->set$'
            ])
        });
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });
});


describe('testing with fuzzy matching', () => {
    test('test with fuzzy in set', () => {
        const left = {
            set: [
                [{ id: 0, label: 0 }],
                [{ id: 1, label: 1 }],
                [{ id: 2, label: 2 }, 'c', 'd'],
                [{ id: 3, label: 3 }, 'e', 'f'],
                [{ id: 4, label: 4 }, 'g', 'h'],
                [{ id: 5, label: 5 }, 'i', 'j']
            ]
        };

        const right = {
            set: [
                [{ id: 4, label: 444 }],
                [{ id: 1, label: 3 }, 'e', 'f'],
                [{ id: 1, label: 111 }],
                [{ id: 5, label: 5 }, 'i', 'j'],
                [{ id: 2, label: 2 }, 'c', 'dddd'],
                [{ id: 9, label: 9 }, 'z', 'k']
            ]
        };
        const expected = {
            'list:add': [
                {
                    left: '__NON_EXIST__',
                    right: [{ id: 9, label: 9 }, 'z', 'k'],
                    left_path: '',
                    right_path: 'set->[5]'
                },
                {
                    left: '__NON_EXIST__',
                    right: 'dddd',
                    left_path: '',
                    right_path: 'set->[4]->[2]'
                }
            ],
            'list:remove': [
                {
                    left: [{ id: 0, label: 0 }],
                    right: '__NON_EXIST__',
                    left_path: 'set->[0]',
                    right_path: ''
                },
                {
                    left: 'd',
                    right: '__NON_EXIST__',
                    left_path: 'set->[2]->[2]',
                    right_path: ''
                },
                {
                    left: 'g',
                    right: '__NON_EXIST__',
                    left_path: 'set->[4]->[1]',
                    right_path: ''
                },
                {
                    left: 'h',
                    right: '__NON_EXIST__',
                    left_path: 'set->[4]->[2]',
                    right_path: ''
                }
            ],
            value_changes: [
                {
                    left: 1,
                    right: 111,
                    left_path: 'set->[1]->[0]->label',
                    right_path: 'set->[2]->[0]->label',
                    old: 1,
                    new: 111
                },
                {
                    left: 3,
                    right: 1,
                    left_path: 'set->[3]->[0]->id',
                    right_path: 'set->[1]->[0]->id',
                    old: 3,
                    new: 1
                },
                {
                    left: 4,
                    right: 444,
                    left_path: 'set->[4]->[0]->label',
                    right_path: 'set->[0]->[0]->label',
                    old: 4,
                    new: 444
                }
            ]
        };

        const ycm = new YouchamaJsonDiffer(left, right, {
            ignore_order_func: make_ignore_order_func(['^set$'])
        });
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });

    test('test with fuzzy in set', () => {
        const left = {
            set: [
                { id: 0, label: 0 },
                { id: 1, label: 1 },
                { id: 2, label: 2 },
                { id: 3, label: 3 },
                { id: 4, label: 4 },
                { id: 5, label: 5 }
            ]
        };

        const right = {
            set: [
                { id: 4, label: 444 },
                { id: 3, label: 3 },
                { id: 1, label: 111 },
                { id: 5, label: 5 },
                { id: 2, label: 2 },
                { id: 9, label: 9 },
                { id: 10, label: 10 }
            ]
        };
        const expected = {
            'list:add': [
                {
                    left: '__NON_EXIST__',
                    right: { id: 9, label: 9 },
                    left_path: '',
                    right_path: 'set->[5]'
                },
                {
                    left: '__NON_EXIST__',
                    right: { id: 10, label: 10 },
                    left_path: '',
                    right_path: 'set->[6]'
                }
            ],
            'list:remove': [
                {
                    left: { id: 0, label: 0 },
                    right: '__NON_EXIST__',
                    left_path: 'set->[0]',
                    right_path: ''
                }
            ],
            value_changes: [
                {
                    left: 1,
                    right: 111,
                    left_path: 'set->[1]->label',
                    right_path: 'set->[2]->label',
                    old: 1,
                    new: 111
                },
                {
                    left: 4,
                    right: 444,
                    left_path: 'set->[4]->label',
                    right_path: 'set->[0]->label',
                    old: 4,
                    new: 444
                }
            ]
        };

        const ycm = new YouchamaJsonDiffer(left, right, {
            ignore_order_func: make_ignore_order_func(['^set$'])
        });
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });

    test('test with fuzzy in set (different types)', () => {
        const left = {
            set: [
                ['a', 0, 1],
                ['b', 1, 2]
            ]
        };

        const right = {
            set: [
                ['b', 1, 2],
                ['a', 0, 1]
            ]
        };
        const expected = {};

        const ycm = new YouchamaJsonDiffer(left, right, {
            ignore_order_func: make_ignore_order_func(['^set$'])
        });
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });

    test('test with fuzzy in set (different types)', () => {
        const left = {
            set_in_set: [
                {
                    id: 1,
                    label: 'label:1',
                    set: [1, 5, 3]
                },
                {
                    id: 2,
                    label: 'label:2',
                    set: [4, 5, 6]
                }
            ]
        };

        const right = {
            set_in_set: [
                {
                    id: 2,
                    label: 'label:2',
                    set: [6, 5, 4]
                },
                {
                    id: 1,
                    label: 'label:1111',
                    set: [3, 2, 1]
                }
            ]
        };
        const expected = {
            'list:add': [
                {
                    left: '__NON_EXIST__',
                    right: 2,
                    left_path: '',
                    right_path: 'set_in_set->[1]->set->[1]'
                }
            ],
            'list:remove': [
                {
                    left: 5,
                    right: '__NON_EXIST__',
                    left_path: 'set_in_set->[0]->set->[1]',
                    right_path: ''
                }
            ],
            value_changes: [
                {
                    left: 'label:1',
                    right: 'label:1111',
                    left_path: 'set_in_set->[0]->label',
                    right_path: 'set_in_set->[1]->label',
                    old: 'label:1',
                    new: 'label:1111'
                }
            ]
        };

        const ycm = new YouchamaJsonDiffer(left, right, {
            ignore_order_func: make_ignore_order_func([
                '^set_in_set$',
                '^set_in_set->\\[\\d+\\]->set$'
            ])
        });
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });
});