const Flow = require("../models/Flow");
const FlowNode = require("../models/FlowNode");
const FlowSession = require("../models/FlowSession");
const { sessions } = require("../sessionStore");

class FlowEngine {
  async handleIncoming(phone, remoteJid, incomingText) {
    const cleanText = incomingText.toLowerCase().trim();
    console.log(`[FlowEngine] Incoming: "${cleanText}" from ${remoteJid} to ${phone}`);

    // 1. Check for a NEW trigger first (allows users to jump out of stuck flows)
    const flow = await Flow.findOne({
      where: { trigger: cleanText, userNumber: phone, isActive: true }
    });

    if (flow) {
      console.log(`[FlowEngine] Trigger Match Found: "${flow.name}"`);
      // Clear any old session for this user first
      await FlowSession.destroy({ where: { phone: remoteJid, userNumber: phone } });
      return await this.startFlow(phone, remoteJid, flow);
    }

    // 2. If no new trigger, check if user is in an active session
    let session = await FlowSession.findOne({
      where: { phone: remoteJid, userNumber: phone }
    });

    if (session) {
      console.log(`[FlowEngine] Continuing active session for ${remoteJid} at node ${session.currentNodeId}`);
      return await this.continueFlow(phone, remoteJid, session, incomingText);
    }

    console.log(`[FlowEngine] No flow or session matched for "${cleanText}"`);
    return false;
  }

  async startFlow(phone, remoteJid, flow) {
    const firstNode = await FlowNode.findOne({
      where: { flowId: flow.id },
      order: [['id', 'ASC']]
    });

    if (!firstNode) {
        console.error(`[FlowEngine] Error: Flow "${flow.name}" has no nodes!`);
        return false;
    }

    const session = await FlowSession.create({
      phone: remoteJid,
      userNumber: phone,
      flowId: flow.id,
      currentNodeId: firstNode.nodeId
    });

    console.log(`[FlowEngine] Flow started. Executing first node: ${firstNode.nodeId}`);
    await this.executeNode(phone, remoteJid, firstNode, session);
    return true;
  }

  async continueFlow(phone, remoteJid, session, userReply) {
    const cleanReply = userReply.toLowerCase().trim();
    const currentNode = await FlowNode.findOne({
      where: { flowId: session.flowId, nodeId: session.currentNodeId }
    });

    if (!currentNode) {
      console.log(`[FlowEngine] Current node ${session.currentNodeId} not found, ending session.`);
      await session.destroy();
      return false;
    }

    // Store user reply
    const variables = { ...session.variables, [currentNode.nodeId]: userReply };
    await session.update({ variables });

    let nextNodeId = null;

    if (currentNode.type === "buttons") {
      const btn = currentNode.data.buttons?.find(b =>
        String(b.id).toLowerCase() === cleanReply ||
        String(b.title).toLowerCase() === cleanReply
      );
      nextNodeId = btn ? (btn.next || currentNode.next) : null;
    } else if (currentNode.type === "list") {
      const allRows = [];
      currentNode.data.sections?.forEach(s => allRows.push(...(s.rows || [])));
      const row = allRows.find(r =>
        String(r.id).toLowerCase() === cleanReply ||
        String(r.title).toLowerCase() === cleanReply
      );
      nextNodeId = row ? (row.next || currentNode.next) : null;
    } else {
      nextNodeId = currentNode.next;
    }

    if (nextNodeId) {
      const nextNode = await FlowNode.findOne({
        where: { flowId: session.flowId, nodeId: String(nextNodeId) }
      });

      if (nextNode) {
        console.log(`[FlowEngine] User replied: "${userReply}". Moving to: ${nextNodeId}`);
        await session.update({ currentNodeId: String(nextNodeId), lastInteraction: new Date() });
        await this.executeNode(phone, remoteJid, nextNode, session);
        return true;
      }
    }

    console.log(`[FlowEngine] Flow sequence ended for ${remoteJid}`);
    await session.destroy();
    return false;
  }

  async executeNode(phone, remoteJid, node, session) {
    if (node.type === "condition") {
      console.log(`[FlowEngine] Evaluating condition at node ${node.nodeId}`);
      const nextNodeId = this.evaluateCondition(node, session.variables);
      const nextNode = await FlowNode.findOne({
        where: { flowId: session.flowId, nodeId: String(nextNodeId) }
      });
      if (nextNode) {
        await session.update({ currentNodeId: String(nextNodeId) });
        return await this.executeNode(phone, remoteJid, nextNode, session);
      }
    }

    await this.sendNodeMessage(phone, remoteJid, node);

    // Auto-advance logic for simple messages
    if (["text", "image"].includes(node.type) && node.next) {
        const nextNode = await FlowNode.findOne({
            where: { flowId: session.flowId, nodeId: String(node.next) }
        });
        if (nextNode) {
            console.log(`[FlowEngine] Auto-advancing from ${node.nodeId} to ${node.next}`);
            await session.update({ currentNodeId: String(node.next) });
            await new Promise(r => setTimeout(r, 1500)); // Natural delay
            return await this.executeNode(phone, remoteJid, nextNode, session);
        }
    }
  }

  evaluateCondition(node, variables) {
    const { key, operator, value, onTrue, onFalse } = node.data;
    const actualValue = variables[key];
    console.log(`[FlowEngine] Condition: Var(${key}) [${actualValue}] ${operator} "${value}"`);

    let result = false;
    switch(operator) {
      case "==": result = String(actualValue) === String(value); break;
      case "!=": result = String(actualValue) !== String(value); break;
      case "contains": result = String(actualValue).toLowerCase().includes(String(value).toLowerCase()); break;
    }
    return result ? onTrue : onFalse;
  }

  async sendNodeMessage(phone, remoteJid, node) {
    const sock = sessions[phone];
    if (!sock) {
        console.error(`[FlowEngine] Critical: WhatsApp socket for ${phone} not found!`);
        return;
    }

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
              buttonId: String(b.id),
              buttonText: { displayText: b.title },
              type: 1
            }));
            await sock.sendMessage(remoteJid, { text: data.text || "Select:", buttons, headerType: 1 });
            break;
          case "list":
            await sock.sendMessage(remoteJid, {
              text: data.text || "Select:",
              title: data.title,
              buttonText: data.buttonText || "Options",
              sections: data.sections
            });
            break;
        }
    } catch (e) {
        console.error(`[FlowEngine] Error sending message:`, e.message);
    }
  }
}

module.exports = new FlowEngine();
