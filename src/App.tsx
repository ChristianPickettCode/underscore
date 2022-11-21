import { useEffect, useState, Dispatch, SetStateAction, Provider } from "react";
import { ethers } from "ethers";

import "./App.css";
import Header from "./components/Header";
import {
  useEthersStore,
  useWorkflowStore,
  WFState,
  Workflow,
} from "./stores/stores";
import Counter from "./abis/Counter.json";
import SimpleStorage from "./abis/SimpleStorage.json";
import Function from "./components/Function";
import { nanoid } from "nanoid";

declare const window: Window & { ethereum: any };

const ListOfContracts = [
  {
    addr: "0x700b6a60ce7eaaea56f065753d8dcb9653dbad35",
    abi: Counter.abi,
  },
  {
    addr: "0xa15bb66138824a1c7167f5e85b957d04dd34e468",
    abi: SimpleStorage.abi,
  },
];

function App() {
  const {
    setProvider,
    setSigner,
    setCurrentAddr,
    addContract,
    setContractFuncList,
    setCurrentContract,
    setCurrentContractABI,
  } = useEthersStore();
  const currentAddr = useEthersStore((state) => state.currentAddr);
  const provider = useEthersStore((state) => state.provider);
  const signer = useEthersStore((state) => state.signer);
  const mapping = useEthersStore((state) => state.contractToFuncList);
  const currentContract = useEthersStore((state) => state.currentContract);
  const currentContractABI = useEthersStore(
    (state) => state.currentContractABI
  );
  const wokflowQueue = useWorkflowStore((state) => state.queue);
  const { getNext, stateTransition } = useWorkflowStore();
  const startWorker = useWorkflowStore((state) => state.start);
  const completeWorker = useWorkflowStore((state) => state.complete);
  const getWorkflow = useWorkflowStore((state) => state.get);
  const getAllWorkflow = useWorkflowStore((state) => state.getAll);
  const updateWorkflow = useWorkflowStore((state) => state.update);
  const clearWorkflow = useWorkflowStore((state) => state.clear);

  const activeWorkflow = useWorkflowStore((state) => state.active);

  useEffect(() => {
    if (window.ethereum) {
      connect();
      ListOfContracts.forEach((c) => {
        setContractFuncMapping(c.abi, c.addr);
      });
      setCurrentContract(
        new ethers.Contract(
          ListOfContracts[0].addr,
          ListOfContracts[0].abi,
          signer
        )
      );
      setCurrentContractABI(ListOfContracts[0].abi);
    }

    return () => {};
  }, []);

  const setContractFuncMapping = (abi: any, addr: string) => {
    const iface = new ethers.utils.Interface(abi);
    const functions = iface.format(
      ethers.utils.FormatTypes.minimal
    ) as string[];
    const contract = new ethers.Contract(addr, abi, provider);
    addContract(contract);
    setContractFuncList(contract.address, functions);
  };

  const connect = async () => {
    const p = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(p);

    await p.send("eth_requestAccounts", []);
    const s = p.getSigner();
    setSigner(s);

    const addr = await s.getAddress();
    setCurrentAddr(addr);
  };

  const toggleContracts = (contract: any) => {
    setCurrentContract(
      new ethers.Contract(contract.addr, contract.abi, signer)
    );
    setCurrentContractABI(contract.abi);
  };

  const parseResponse = (res: any): any => {
    switch (res.constructor.name) {
      case "BigNumber":
        return [ethers.utils.formatUnits(res, "wei")];
      case "Array":
        return (res as Array<any>)
          .map((v: any, i: any) => {
            return parseResponse(v);
          })
          .reduce((res, item) => {
            return [...res, ...item];
          });
      case "Object":
        return parseResponse(res.value);
      default:
        return res;
    }
  };

  const parseWorkflowArgs = (wf: Workflow): string[] => {
    const pattern = "WF#([A-Za-z0-9_-]*)";
    const patternWithArgs = pattern + "#([A-Za-z0-9_-])$";
    let updated = wf.args;
    for (let i = 0; i < wf.args.length; i++) {
      if (wf.usesWfArgs[i]) {
        const cleanedInput = wf.args[i].trim();
        const res = cleanedInput.match(patternWithArgs);
        if (res === null) {
          alert("workflow arg invalid");
          continue;
        }

        const argId = Number(res[2]);
        if (isNaN(argId)) {
          alert("workflow argId invalid character");
          continue;
        }

        const wfId = res[1];
        const retrievedWf = getAllWorkflow(`WF#${wfId}`);
        if (retrievedWf === undefined) {
          alert("workflow wfId invalid");
          continue;
        }

        console.log(`workflow : ${wfId} with arg : ${argId}`);
        console.log(retrievedWf);
        const outputArg = retrievedWf.output[argId];
        if (outputArg === undefined) {
          alert("workflow argId invalid output arg");
          continue;
        }

        updated[i] = outputArg;
      }
    }

    return updated;
  };

  const runWorker = async (wf: Workflow) => {
    startWorker(wf?.id as string);

    const addr = (wf.contract as ethers.Contract).address;
    const abi = wf.abi;
    const contract = new ethers.Contract(addr, abi, signer);

    const iface = new ethers.utils.Interface(abi);
    const funcDetails = iface.getFunction(wf.funcSign);

    let res: ethers.providers.TransactionResponse;
    if (wf.args.length !== funcDetails.inputs.length) {
      alert("invalid args");
      return;
    }

    const parsedArgs = parseWorkflowArgs(wf);
    updateWorkflow(wf.id, "args", parsedArgs);

    res = await contract[`${wf.funcSign}`](...parsedArgs);
    var r = parseResponse(res);

    if (funcDetails.stateMutability === "view") {
      console.log("Worker done...");
      completeWorker(wf?.id as string, r);
      return;
    }

    let receipt = await res.wait(2);
    console.log(receipt);
    console.log("Worker done...");
    completeWorker(wf?.id as string, r);
  };

  const runWorkflow = async () => {
    console.log("Running workflow....");

    console.log(wokflowQueue);

    for (let index = 0; index < wokflowQueue.length; index++) {
      // while (activeWorkflow == true) {}
      const next = getNext();
      if (next) {
        await runWorker(next);
      }
    }
  };

  return (
    <div className="App">
      <Header />
      {currentAddr && <h2>{currentAddr}</h2>}

      <div className="card">
        {!signer ? (
          <button onClick={connect}>Connect</button>
        ) : (
          <div>
            <div>
              {ListOfContracts.map((c, i) => {
                return (
                  <button
                    style={{ margin: "1rem" }}
                    key={nanoid()}
                    onClick={() => toggleContracts(c)}
                  >
                    Contract {i}
                  </button>
                );
              })}
              <button onClick={runWorkflow} style={{ marginInline: "1rem" }}>
                Run Workflow
              </button>

              <button onClick={clearWorkflow} style={{ marginInline: "1rem" }}>
                Clear Workflow
              </button>
            </div>

            <div>
              {mapping
                .get((currentContract as ethers.Contract).address)
                ?.map((func, i) => {
                  return <Function key={nanoid()} sig={func} index={i} />;
                })}
            </div>
            <br />
            <hr />
            <br />
            <h2>Workflows</h2>
            <div>
              {wokflowQueue.map((w) => {
                return (
                  <div
                    key={w.id}
                    onClick={() => {
                      console.log(w);
                    }}
                  >
                    <p>
                      {WFState[w.state].toString()} - {w.id} - {w.funcSign} -{" "}
                      {w.args} - {w.output}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
