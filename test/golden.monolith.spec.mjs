// Golden suite vs the MONOLITH (game.js via vm sandbox). This is the "before"
// pin — the module split must keep every assertion green, then the same suite
// runs against src/ in golden.modules.spec.mjs.
import { makeMonolithEngine } from "./monolith-sandbox.mjs";
import { runGoldenSuite } from "./golden-suite.mjs";

const engine = makeMonolithEngine(1337);
runGoldenSuite("monolith", engine, (seed) => engine.__setSeed(seed));
