import { WorkflowStage } from '../../types';

export type EventTopic =
  | 'incident.created'
  | 'incident.validated'
  | 'incident.assigned'
  | 'incident.dispatched'
  | 'incident.updated'
  | 'incident.escalated'
  | 'incident.resolved';

export interface WorkflowEvent {
  topic: EventTopic;
  incidentId: string;
  timestamp: string;
  stage: WorkflowStage;
  payload: Record<string, any>;
}

type EventCallback = (event: WorkflowEvent) => void;

class KafkaEventBus {
  private listeners: Map<EventTopic, EventCallback[]> = new Map();

  public subscribe(topic: EventTopic, callback: EventCallback): () => void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, []);
    }
    this.listeners.get(topic)!.push(callback);

    return () => {
      const arr = this.listeners.get(topic) || [];
      this.listeners.set(
        topic,
        arr.filter((cb) => cb !== callback)
      );
    };
  }

  public publish(topic: EventTopic, incidentId: string, stage: WorkflowStage, payload: Record<string, any>): void {
    const event: WorkflowEvent = {
      topic,
      incidentId,
      timestamp: new Date().toISOString(),
      stage,
      payload,
    };

    console.log(`[Kafka Event Bus] Published [${topic}] for incident ${incidentId} in state ${stage}`);

    const handlers = this.listeners.get(topic) || [];
    handlers.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error(`Error executing event bus handler for ${topic}:`, err);
      }
    });
  }
}

export const kafkaEventBus = new KafkaEventBus();
