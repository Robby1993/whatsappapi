import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'Tokens',
  timestamps: false,
})
export class Token extends Model<Token> {
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  token: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  number: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  userType: string;
}
