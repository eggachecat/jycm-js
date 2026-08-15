import { KMMatcher } from '../src/km_matcher';

describe('testing general', () => {
    test('reports verbose matching diagnostics', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const [sum, pairs] = new KMMatcher([[1]]).solve(true);

        expect(sum).toBe(1);
        expect(pairs).toStrictEqual([[0, 0]]);
        expect(log).toHaveBeenCalledWith('match 0 to 0, weight 1.0000');
        expect(log).toHaveBeenCalledWith('ans: 1.0000');
        log.mockRestore();
    });

    test('test KMMatcher', () => {
        const matcher = new KMMatcher([
            [2, 3, 0, 3],
            [0, 4, 0, 100],
            [5, 6, 0, 0]
        ]);

        const [sum, pairs] = matcher.solve(false);
        expect(sum).toEqual(108);
        expect(pairs).toStrictEqual([
            [0, 1],
            [1, 3],
            [2, 0]
        ]);
    });
    test('test KMMatcher', () => {
        const matcher = new KMMatcher([
            [2, 0, 5],
            [3, 4, 6],
            [0, 0, 0],
            [3, 100, 0]
        ]);

        const [sum, pairs] = matcher.solve(false);
        expect(sum).toEqual(108);
        expect(pairs).toStrictEqual([
            [1, 0],
            [3, 1],
            [0, 2]
        ]);
    });

    test('test KMMatcher', () => {
        const matcher = new KMMatcher([
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ]);

        const [sum, pairs] = matcher.solve(false);
        expect(sum).toEqual(3);
        expect(pairs).toStrictEqual([
            [1, 0],
            [2, 1],
            [3, 2]
        ]);
    });

    
    test('test KMMatcher', () => {
        const matcher = new KMMatcher([
            [10, 10, 10],
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ]);

        const [sum, pairs] = matcher.solve(false);
        expect(sum).toEqual(12);
        expect(pairs).toStrictEqual([
            [1, 0],
            [2, 1],
            [0, 2]
        ]);
    });

    test('test KMMatcher', () => {
        const matcher = new KMMatcher([
            [1, 0, 0, 2],
            [0, 1, 0, 2],
            [0, 0, 1, 2]
        ]);

        const [sum, pairs] = matcher.solve(false);
        expect(sum).toEqual(4);
        expect(pairs).toStrictEqual([
            [0, 0],
            [1, 3],
            [2, 2]
        ]);
    });
});
