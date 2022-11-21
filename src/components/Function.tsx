import { Fragment, useState } from "react";
import { ethers } from "ethers";
import { useEthersStore, useWorkflowStore, WFState } from "../stores/stores";
import { nanoid } from "nanoid";

type Props = {
  sig: string;
  index: number;
};

interface BooleanArray {
  [index: number]: boolean;
}

interface NumArray {
  [index: number]: number;
}

const Function = ({ sig, index }: Props) => {
  const name = sig.split(" ")[1];
  const signer = useEthersStore((state) => state.signer);
  const currentContract = useEthersStore((state) => state.currentContract);
  const currentContractABI = useEthersStore(
    (state) => state.currentContractABI
  );

  const addToWorkflow = useWorkflowStore((state) => state.add);

  const setUsesWfArgs = useWorkflowStore((state) => state.setUsesWfArgs);
  const queue = useWorkflowStore((state) => state.queue);
  const getAllWorkflow = useWorkflowStore((state) => state.getAll);

  const iface = new ethers.utils.Interface(currentContractABI);
  const funcDetails = iface.getFunction(name);
  const [callArgs, setCallArgs] = useState<Partial<string[]>>([]);
  const [output, setOutput] = useState([]);
  const [localUseWfArgs, setLocalUseWfArgs] = useState(
    new Array(10).fill(false)
  );
  const [
    inputIndexToBoolUsesWFArgMapping,
    setInputIndexToBoolUsesWFArgMapping,
  ] = useState<Partial<BooleanArray>>({
    0: false,
  });
  const [inputIndexToArgNumMapping, setInputIndexToArgNumMapping] = useState<
    Partial<NumArray>
  >({});
  //   const [usesWfArgsObj, setUsesWfArgsObj] = useState({});

  const setFuncArgWfID = (inputIndex: number, wfID: any) => {
    console.log("#####- UPDATING -########");
    if (inputIndexToBoolUsesWFArgMapping[inputIndex]) {
      console.log(wfID);
      let argsArr: any = [...callArgs];
      argsArr[inputIndex] = wfID;
      setCallArgs(argsArr);
    } else {
      let argsArr: any = [...callArgs];
      argsArr[inputIndex] = wfID;
      setCallArgs(argsArr);
    }
  };

  const setFuncArgNum = (inputIndex: number, wfArgNum: string) => {
    const cleanedWfArgNum = Number(wfArgNum.trim());

    if (cleanedWfArgNum === undefined || cleanedWfArgNum === null) {
      alert("Err parsing argnum to number");
    }
    console.log("updateArgNum", inputIndex, cleanedWfArgNum);
    setInputIndexToArgNumMapping((prev) => ({
      ...prev,
      [inputIndex]: cleanedWfArgNum,
    }));

    let argsArr = [...callArgs];
    for (let i = 0; i < argsArr.length; i++) {
      if (i === inputIndex) {
        argsArr[i] = argsArr[i] + "#" + wfArgNum;
      }
    }
    setCallArgs(argsArr);
  };

  const clearArgs = () => {
    Array.from(document.querySelectorAll("input")).forEach(
      (input) => (input.value = "")
    );
    setCallArgs([]);
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

  const validateArgs = (args: any[]): boolean => {
    if (args.length !== funcDetails.inputs.length) {
      return false;
    }

    return true;
  };

  const callFunc = async (
    name: string,
    args: any[],
    funcDetails: ethers.utils.FunctionFragment
  ) => {
    const contract = new ethers.Contract(
      (currentContract as ethers.Contract).address,
      currentContractABI,
      signer
    );

    let res: ethers.providers.TransactionResponse;
    const valid = validateArgs(args);
    if (valid) {
      res = await contract[`${name}`](...args);
      //   if (funcDetails.stateMutability !== "view") {
      //     let receipt = await res.wait(2);
      //     console.log(receipt);
      //   }
      var r = parseResponse(res);
      setOutput(r);

      clearArgs();
    } else {
      alert("Not valid arguments");
    }
  };

  const addToWf = () => {
    console.log("Adding to workflow...");
    const id = addToWorkflow({
      id: `WF#${nanoid()}`, // queue.length.toString()
      contract: currentContract,
      abi: currentContractABI,
      funcSign: name,
      args: callArgs,
      state: WFState.CREATED,
      output: [],
      usesWfArgs: localUseWfArgs,
    });
    console.log(`Added with workflow id-${id}`);
  };

  const toggleInputCheckbox = (index: number) => {
    let updated = localUseWfArgs;
    for (let i = 0; i < localUseWfArgs.length; i++) {
      if (i === index) {
        updated[i] = !updated[i];
      }
    }
    setInputIndexToBoolUsesWFArgMapping((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
    setLocalUseWfArgs(updated);
  };

  const argNumMap = (inputIndex: number) => {
    const defaultRes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (
      inputIndexToBoolUsesWFArgMapping[inputIndex] &&
      callArgs.length > inputIndex &&
      callArgs[inputIndex] != undefined
    ) {
      console.log(callArgs, inputIndex);
      const inputWfId: string = callArgs[inputIndex] as string;
      console.log(inputWfId);

      const pattern = "WF#([A-Za-z0-9_-]*)";
      const patternWithArgs = pattern + "#([A-Za-z0-9_-])$";
      let res = inputWfId.match(patternWithArgs);

      if (res === null || res === undefined) {
        console.log(inputWfId);
        res = inputWfId.match(`${pattern}$`);
        if (res === null || res === undefined) {
          alert("argNum err parse arg");
          return defaultRes;
        }
      }
      console.log(res);
      const wfId = res[1];
      const retrievedWf = getAllWorkflow(`WF#${wfId}`);
      if (retrievedWf === undefined) {
        console.log(wfId);
        alert("argNum err getAllWorkflow");
        return defaultRes;
      }
      console.log(retrievedWf);
      const funcSign = retrievedWf.funcSign;

      const iface = new ethers.utils.Interface(currentContractABI);

      const funcFrag = iface.getFunction(funcSign);
      if (funcFrag === undefined || funcFrag === null) {
        console.log(funcSign);
        alert("argNum err iface.getFunction");
        return defaultRes;
      }

      const outputArr = funcFrag.outputs;
      if (outputArr === undefined || outputArr === null) {
        console.log(funcFrag);
        alert("argNum err funcFrag.outputs");
        return defaultRes;
      }

      return outputArr;
    }
    return defaultRes;
  };

  return (
    <div style={{ margin: "1rem", textAlign: "left" }}>
      <button
        style={{ backgroundColor: "green", color: "white", fontWeight: "bold" }}
        onClick={addToWf}
      >
        Add
      </button>
      <button
        style={{ marginInline: "2rem" }}
        onClick={() => callFunc(name, callArgs, funcDetails)}
      >
        {sig}
      </button>
      {output.map((v) => {
        return (
          <span key={nanoid()} style={{ marginInline: "0.5rem" }}>
            {v}
          </span>
        );
      })}

      {signer &&
        currentContractABI &&
        funcDetails.inputs?.map((args, inputIndex) => {
          return (
            <Fragment key={`${inputIndex}-${args.type}`}>
              {inputIndexToBoolUsesWFArgMapping[inputIndex] ? (
                <Fragment>
                  <select
                    id={nanoid()}
                    defaultValue="default"
                    onChange={(e) => setFuncArgWfID(inputIndex, e.target.value)}
                  >
                    <option value="default" disabled>
                      workflows
                    </option>
                    {queue.map((v, i) => {
                      return (
                        <option key={v.id} value={v.id}>
                          {v.id}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    defaultValue="default"
                    onChange={(e) => setFuncArgNum(inputIndex, e.target.value)}
                  >
                    <option value="default" disabled>
                      Args
                    </option>
                    {argNumMap(inputIndex).map((_, index) => {
                      return (
                        <option key={`${inputIndex}-${index}`}>{index}</option>
                      );
                    })}
                  </select>
                </Fragment>
              ) : (
                <input
                  style={{ marginInline: "0.50rem" }}
                  type="text"
                  placeholder={args.type}
                  onChange={(e) => setFuncArgWfID(inputIndex, e.target.value)}
                />
              )}

              <input
                type="checkbox"
                onClick={() => toggleInputCheckbox(inputIndex)}
              />
            </Fragment>
          );
        })}
    </div>
  );
};

export default Function;
