require('dotenv').config();

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const ASSISTANT_ID = "da13752f-c8f3-464f-b1db-77bc989ee5ed";

const BAD_TOOL_ID = "65386ba6-4f35-425d-abfb-7592cd84c872";

async function main() {
  if (!VAPI_API_KEY) {
    throw new Error("VAPI_API_KEY is missing");
  }

  // Get current assistant
  const getResponse = await fetch(
    `https://api.vapi.ai/assistant/${ASSISTANT_ID}`,
    {
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`
      }
    }
  );

  const assistant = await getResponse.json();

  if (!getResponse.ok) {
    throw new Error(JSON.stringify(assistant, null, 2));
  }

  console.log("Assistant:", assistant.name);

  const currentModel = assistant.model;

  console.log("Old toolIds:");
  console.log(currentModel.toolIds);

  // Remove ONLY the deleted tool
  const cleanedToolIds = (currentModel.toolIds || []).filter(
    id => id !== BAD_TOOL_ID
  );

  console.log("\nNew toolIds:");
  console.log(cleanedToolIds);

  // Preserve the entire model configuration
  const updatedModel = {
    ...currentModel,
    toolIds: cleanedToolIds
  };

  // Update assistant
  const patchResponse = await fetch(
    `https://api.vapi.ai/assistant/${ASSISTANT_ID}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: updatedModel
      })
    }
  );

  const result = await patchResponse.json();

  if (!patchResponse.ok) {
    console.error("PATCH FAILED:");
    console.error(JSON.stringify(result, null, 2));
    return;
  }

  console.log("\n✅ SUCCESS");
  console.log("Updated toolIds:");
  console.log(result.model?.toolIds);
}

main().catch(console.error);