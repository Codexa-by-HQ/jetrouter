import { Router, createRouter, type RouteMatch, type Matcher } from "jetrouter";
type Data = { id: number; handler: () => string };
const router = createRouter<Data>();
router.add("GET", "/users/:id", { id: 1, handler: () => "ok" });
const result: RouteMatch<Data> | undefined = router.find("GET", "/users/42");
const matcher: Matcher<Data> = router.snapshot();
const id: number | undefined = result?.data.id;
const parameter: string | undefined = result?.params?.id;
const named: Router<Data> = new Router<Data>();
// @ts-expect-error data does not satisfy the router's declared payload type
named.add("GET", "/", "bad");
// @ts-expect-error option values are constrained
new Router({ trailingSlash: "sometimes" });
// @ts-expect-error params are declared read-only
if (result?.params) result.params.id = "mutated";
void [matcher, id, parameter];

new Router({ allowCustomRegex: false });
// @ts-expect-error the regex policy must be a boolean
new Router({ allowCustomRegex: "false" });
