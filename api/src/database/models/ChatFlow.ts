import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'ChatFlows',
  timestamps: true,
})
export class ChatFlow extends Model {
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  userNumber: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  triggerKeyword: string;

  @Column({
    type: DataType.ENUM('text', 'image', 'video', 'audio', 'document', 'buttons', 'list'),
    defaultValue: 'text',
  })
  responseType: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  responseText: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  mediaUrl: string;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  buttons: string[];

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  sections: any[];

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  header: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  footer: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive: boolean;
}
