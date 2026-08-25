import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'ChatSessions',
  timestamps: true,
})
export class ChatSession extends Model<ChatSession> {
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  senderJid: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  botPhone: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  currentFlowId: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  currentStepIndex: number;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  context: any;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  lastInteraction: Date;
}
