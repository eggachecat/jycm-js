// from: https://github.com/mayorx/hungarian-algorithm
// translated by CHATGPT4

export class KMMatcher {
    private weights: number[][];
    private n: number;
    private m: number;
    private reverted: boolean;
    private label_x: number[];
    private label_y: number[];
    private max_match: number;
    private xy: number[];
    private yx: number[];
    private S: boolean[];
    private T: boolean[];
    private slack: number[];
    private slackyx: number[];
    private prev: number[];

    // weights : nxm weight matrix (number[][], float), n <= m
    constructor(weights: number[][]) {
        this.weights = weights.map((row) => row.slice());
        this.n = weights.length;
        this.m = weights[0].length;

        this.reverted = false;
        if (this.n > this.m) {
            this.reverted = true;
            this.transposeWeights();
        }

        // init label
        this.label_x = this.weights.map((row) => Math.max(...row));
        this.label_y = new Array(this.m).fill(0);

        this.max_match = 0;
        this.xy = new Array(this.n).fill(-1);
        this.yx = new Array(this.m).fill(-1);
    }

    // Transposes the weights matrix
    private transposeWeights() {
        const transposed: number[][] = [];
        for (let i = 0; i < this.m; i++) {
            transposed.push([]);
            for (let j = 0; j < this.n; j++) {
                transposed[i].push(this.weights[j][i]);
            }
        }
        this.weights = transposed;
        [this.n, this.m] = [this.m, this.n];
    }

    private do_augment(x: number, y: number): void {
        this.max_match += 1;
        while (x != -2) {
            this.yx[y] = x;
            let ty = this.xy[x];
            this.xy[x] = y;
            [x, y] = [this.prev[x], ty];
        }
    }

    private find_augment_path(): [number, number] {
        this.S = new Array(this.n).fill(false);
        this.T = new Array(this.m).fill(false);

        this.slack = new Array(this.m).fill(Infinity);

        // l[slackyx[y]] + l[y] - w[slackx[y], y] == slack[y]
        this.slackyx = new Array(this.m).fill(-1);

        this.prev = new Array(this.n).fill(-1);

        let queue: number[] = [];
        let st = 0;
        let root = -1;

        for (let x = 0; x < this.n; x++) {
            if (this.xy[x] === -1) {
                queue.push(x);
                root = x;
                this.prev[x] = -2;
                this.S[x] = true;
                break;
            }
        }

        for (let y = 0; y < this.m; y++) {
            this.slack[y] =
                this.label_y[y] + this.label_x[root] - this.weights[root][y];
        }
        this.slackyx.fill(root);

        while (true) {
            while (st < queue.length) {
                let x = queue[st];
                st++;

                for (let y = 0; y < this.m; y++) {
                    if (this.isInGraph(x, y) && !this.T[y]) {
                        if (this.yx[y] === -1) {
                            return [x, y];
                        }
                        this.T[y] = true;
                        queue.push(this.yx[y]);
                        this.add_to_tree(this.yx[y], x);
                    }
                }
            }

            this.update_labels();
            queue = [];
            st = 0;

            for (let y = 0; y < this.m; y++) {
                if (this.slack[y] === 0 && !this.T[y]) {
                    let x = this.slackyx[y];
                    if (this.yx[y] === -1) {
                        return [x, y];
                    }
                    this.T[y] = true;
                    if (!this.S[this.yx[y]]) {
                        queue.push(this.yx[y]);
                        this.add_to_tree(this.yx[y], x);
                    }
                }
            }
        }
    }

    private isInGraph(x: number, y: number): boolean {
        return (
            Math.abs(this.weights[x][y] - this.label_x[x] - this.label_y[y]) <
            1e-10
        );
    }

    private add_to_tree(x: number, prevx: number): void {
        this.S[x] = true;
        this.prev[x] = prevx;

        for (let y = 0; y < this.m; y++) {
            let slackValue =
                this.label_x[x] + this.label_y[y] - this.weights[x][y];
            if (slackValue < this.slack[y]) {
                this.slack[y] = slackValue;
                this.slackyx[y] = x;
            }
        }
    }

    private update_labels(): void {
        let delta = Infinity;

        for (let y = 0; y < this.m; y++) {
            if (!this.T[y] && this.slack[y] < delta) {
                delta = this.slack[y];
            }
        }

        for (let x = 0; x < this.n; x++) {
            if (this.S[x]) {
                this.label_x[x] -= delta;
            }
        }
        for (let y = 0; y < this.m; y++) {
            if (this.T[y]) {
                this.label_y[y] += delta;
            }
        }
        for (let y = 0; y < this.m; y++) {
            if (!this.T[y]) {
                this.slack[y] -= delta;
            }
        }
    }

    public solve(verbose: boolean = false): [number, [number, number][]] {
        while (this.max_match < this.n) {
            const [x, y] = this.find_augment_path();
            this.do_augment(x, y);
        }

        let sum = 0;
        const pairs: [number, number][] = [];
        for (let x = 0; x < this.n; x++) {
            if (verbose) {
                console.log(`match ${x} to ${this.xy[x]}, weight ${this.weights[x][this.xy[x]].toFixed(4)}`);
            }
            pairs.push([x, this.xy[x]]);
            sum += this.weights[x][this.xy[x]];
        }

        if (verbose) {
            console.log(`ans: ${sum.toFixed(4)}`);
        }

        if (this.reverted) {
            return [sum, pairs.map(([x, y]) => [y, x] as [number, number])];
        }
        return [sum, pairs];
    }
}


// const matcher1 = new KMMatcher([
//     [2, 3, 0, 3],
//     [0, 4, 0, 100],
//     [5, 6, 0, 0],
// ]);

// const [sum1, pairs1] = matcher1.solve(true);
// console.log(pairs1);

// const matcher2 = new KMMatcher([
//     [2, 0, 5],
//     [3, 4, 6],
//     [0, 0, 0],
//     [3, 100, 0],
// ]);

// const [sum2, pairs2] = matcher2.solve(true);
// console.log(pairs2);