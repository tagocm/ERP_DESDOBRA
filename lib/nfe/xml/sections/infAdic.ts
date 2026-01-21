import { NfeInfAdic } from "../../domain/types";

export function buildInfAdic(inf: NfeInfAdic) {
    return {
        infCpl: inf.infCpl,
        infAdFisco: inf.infAdFisco
    };
}
