import create from "zustand";
import { devtools } from "zustand/middleware";
import { ethers } from "ethers";

interface EthersState {
  provider: ethers.providers.Web3Provider | any;
  setProvider: (provider: ethers.providers.Web3Provider) => void;
  signer: ethers.providers.JsonRpcSigner | any;
  setSigner: (signer: ethers.providers.JsonRpcSigner) => void;
  currentAddr: string;
  setCurrentAddr: (addr: string) => void;
  contracts: ethers.Contract[];
  addContract: (contracts: ethers.Contract) => void;
  getContract: (addr: string) => ethers.Contract | any;
  contractToFuncList: Map<string, string[]>;
  setContractFuncList: (addr: string, funcList: string[]) => void;
  currentContract: ethers.Contract | any;
  setCurrentContract: (contracts: ethers.Contract) => void;
  currentContractABI: any;
  setCurrentContractABI: (abi: any) => void;
}

export const useEthersStore = create<EthersState>()(
  devtools((set, get) => ({
    provider: null,
    setProvider: (p) => set(() => ({ provider: p })),
    signer: null,
    setSigner: (s) => set(() => ({ signer: s })),
    currentAddr: "",
    setCurrentAddr: (addr) => set(() => ({ currentAddr: addr })),
    contracts: [],
    addContract: (c) =>
      set((state) => ({ contracts: [...state.contracts, c] })),
    getContract: (addr) => {
      return get().contracts.filter((c) => c.address === addr);
    },
    contractToFuncList: new Map(),
    setContractFuncList: (addr, funcList) =>
      set((state) => ({
        contractToFuncList: new Map(state.contractToFuncList).set(
          addr,
          funcList
        ),
      })),
    currentContract: null,
    setCurrentContract: (c) => set(() => ({ currentContract: c })),
    currentContractABI: null,
    setCurrentContractABI: (abi) => set(() => ({ currentContractABI: abi })),
  }))
);

export enum WFState {
  CREATED,
  PENDING,
  COMPLETE,
}

export interface Workflow {
  id: string;
  contract: ethers.Contract;
  abi: any;
  funcSign: string;
  args: any[];
  state: WFState;
  output: any[];
  usesWfArgs: boolean[];
}

interface WorkflowState {
  queue: Workflow[];
  current: Workflow | undefined;
  active: boolean;
  block: () => void;
  unblock: () => void;
  getNext: () => Workflow | undefined;
  add: (w: Workflow) => string;
  get: (id: string) => Workflow;
  getAll: (id: string) => Workflow;
  remove: (id: string) => void;
  update: (id: string, fields: string, value: any) => Workflow;
  clear: () => void;
  stateTransition: (id: string, to: WFState, args: any) => Workflow | undefined;
  start: (id: string) => void;
  complete: (id: string, output: any[]) => void;
  setUsesWfArgs: (id: string, args: boolean[]) => void;
}
export const useWorkflowStore = create<WorkflowState>()(
  devtools((set, get) => ({
    queue: [],
    current: undefined,
    active: false,
    block: () => set((state) => ({ active: true })),
    unblock: () => set((state) => ({ active: false })),
    getNext: () => {
      return get().queue.filter((wf) => wf.state !== WFState.COMPLETE)[0];
    },
    add: (w) => {
      set((state) => ({ queue: [...state.queue, w] }));
      return w.id;
    },
    getAll: (id) => {
      return get().queue.filter((wf) => wf.id === id)[0];
    },
    get: (id) => {
      return get().queue.filter(
        (wf) => wf.id === id && wf.state !== WFState.COMPLETE
      )[0];
    },
    update: (id, field, value) => {
      let curr = get().get(id);
      let updated = get().queue as Workflow[];

      for (let i = 0; i < updated.length; i++) {
        if (updated[i].id === id) {
          let found = { ...updated[i], [field]: value };
          curr = found;
        }
      }
      set(() => ({ queue: updated }));
      return curr;
    },
    remove: (id) =>
      set((state) => ({ queue: state.queue.filter((wf) => wf.id === id) })),
    clear: () => set((state) => ({ queue: [] })),
    stateTransition: (id, to, args) => {
      let curr = get().get(id);
      let updated = get().queue as Workflow[];

      switch (to) {
        case WFState.PENDING:
          get().block();
          for (let i = 0; i < updated.length; i++) {
            if (updated[i].id === id) {
              updated[i].state = to;
              curr = updated[i];
            }
          }
          set(() => ({ queue: updated }));
          return curr;
        case WFState.COMPLETE:
          for (let i = 0; i < updated.length; i++) {
            if (updated[i].id === id) {
              updated[i].state = to;
              updated[i].output = args;
              curr = updated[i];
            }
          }
          set(() => ({ queue: [...updated] }));
          get().unblock();
          return curr;
        default:
          return undefined;
      }
    },
    start: (id) => get().stateTransition(id, WFState.PENDING, {}),
    complete: (id, output) =>
      get().stateTransition(id, WFState.COMPLETE, output),
    setUsesWfArgs: (id, args) => {
      //   let curr = get().get(id);
      let updated = get().queue as Workflow[];
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].id === id) {
          updated[i].usesWfArgs = args;
          //   curr = updated[i];
        }
      }
      set(() => ({ queue: updated }));
    },
  }))
);
