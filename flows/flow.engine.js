const Flow = require("../models/Flow");
const FlowNode = require("../models/FlowNode");
const FlowSession = require("../models/FlowSession");
const { sessions } = require("../routes/whatsapp");

class FlowEngine {
  async handleIncoming(phone, remoteJid, incomingText) {
    const cleanText = incomingText.toLowerCase().trim();

    // 1. Check if user is in an active session
    let session = await FlowSession.findOne({
      where: { phone: remoteJid, userNumber: phone }
    });

    if (session) {
      console.log(`[Flow] Continuing session for ${remoteJid}`);
      return await this.continueFlow(phone, remoteJid, session, incomingText);
    }

    // 2. Check for trigger
    const flow = await Flow.findOne({
      where: { trigger: cleanText, userNumber: phone, isActive: true }
    });

    if (flow) {
      console.log(`[Flow] Starting flow "${flow.name}" for ${remoteJid}`);
      return await this.startFlow(phone, remoteJid, flow);
    }

    return false; // No flow handled
  }

  async startFlow(phone, remoteJid, flow) {
    const firstNode = await FlowNode.findOne({
      where: { flowId: flow.id },
      order: [['id', 'ASC']]
    });

    if (!firstNode) return false;

    const session = await FlowSession.create({
      phone: remoteJid,
      userNumber: phone,
      flowId: flow.id,
      currentNodeId: firstNode.nodeId
    });

    await this.executeNode(phone, remoteJid, firstNode, session);
    return true;
  }

  async continueFlow(phone, remoteJid, session, userReply) {
    const currentNode = await FlowNode.findOne({
      where: { flowId: session.flowId, nodeId: session.currentNodeId }
    });

    if (!currentNode) {
      await session.destroy();
      return false;
    }

    // Store user reply in variables (optional, but good for conditions)
    const variables = { ...session.variables, [currentNode.nodeId]: userReply };
    await session.update({ variables });

    let nextNodeId = null;

    if (currentNode.type === "buttons") {
      const btn = currentNode.data.buttons?.find(b =>
        b.id.toLowerCase() === userReply.toLowerCase() ||
        b.title.toLowerCase() === userReply.toLowerCase()
      );
      nextNodeId = btn ? (btn.next || currentNode.next) : null;
    } else if (currentNode.type === "list") {
      const allRows = [];
      currentNode.data.sections?.forEach(s => allRows.push(...s.rows));
      const row = allRows.find(r =>
        r.id.toLowerCase() === userReply.toLowerCase() ||
        r.title.toLowerCase() === userReply.toLowerCase()
      );
      nextNodeId = row ? (row.next || currentNode.next) : null;
    } else {
      nextNodeId = currentNode.next;
    }

    if (nextNodeId) {
      const nextNode = await FlowNode.findOne({
        where: { flowId: session.flowId, nodeId: nextNodeId }
      });

      if (nextNode) {
        await session.update({ currentNodeId: nextNodeId, lastInteraction: new Date() });
        await this.executeNode(phone, remoteJid, nextNode, session);
        return true;
      }
    }

    // Flow ended or invalid input
    console.log(`[Flow] Ending session for ${remoteJid}`);
    await session.destroy();
    return false;
  }

  async executeNode(phone, remoteJid, node, session) {
    if (node.type === "condition") {
      const nextNodeId = this.evaluateCondition(node, session.variables);
      const nextNode = await FlowNode.findOne({
        where: { flowId: session.flowId, nodeId: nextNodeId }
      });
      if (nextNode) {
        await session.update({ currentNodeId: nextNodeId });
        return await this.executeNode(phone, remoteJid, nextNode, session);
      }
    }

    await this.sendNodeMessage(phone, remoteJid, node);

    // Auto-advance logic
    if (["text", "image"].includes(node.type) && node.next) {
        const nextNode = await FlowNode.findOne({
            where: { flowId: session.flowId, nodeId: node.next }
        });
        if (nextNode) {
            await session.update({ currentNodeId: node.next });
            await new Promise(r => setTimeout(r, 1000));
            return await this.executeNode(phone, remoteJid, nextNode, session);
        }
    }
  }

  evaluateCondition(node, variables) {
    const { key, operator, value, onTrue, onFalse } = node.data;
    const actualValue = variables[key];

    let result = false;
    switch(operator) {
      case "==": result = String(actualValue) === String(value); break;
      case "!=": result = String(actualValue) !== String(value); break;
      case "contains": result = String(actualValue).includes(value); break;
    }

    return result ? String(onTrue) : String(onFalse);
  }

  async sendNodeMessage(phone, remoteJid, node) {
    const sock = sessions[phone];
    if (!sock) return;

    const { type, data } = node;

    try {
        switch (type) {
          case "text":
            await sock.sendMessage(remoteJid, { text: data.text });
            break;
          case "image":
            await sock.sendMessage(remoteJid, { image: { url: data.url }, caption: data.caption });
            break;
          case "buttons":
            const buttons = data.buttons.map(b => ({
              buttonId: b.id,
              buttonText: { displayText: b.title },
              type: 1
            }));
            await sock.sendMessage(remoteJid, { text: data.text, buttons, headerType: 1 });
            break;
          case "list":
            await sock.sendMessage(remoteJid, {
              text: data.text,
              title: data.title,
              buttonText: data.buttonText || "Options",
              sections: data.sections
            });
            break;
        }
    } catch (e) {
        console.error(`[Flow Engine] Error sending message:`, e.message);
    }
  }
}

module.exports = new FlowEngine();
